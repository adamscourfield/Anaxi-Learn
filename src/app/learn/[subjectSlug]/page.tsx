import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import { prisma } from '@/db/prisma';
import { LearnSession } from '@/features/learn/LearnSession';
import { isSkillUnlocked } from '@/features/learn/prerequisites';
import { getUserGamificationSummary } from '@/features/gamification/gamificationService';
import { selectExplanationRoute } from '@/features/diagnostic/routeAssignment';
import { emitEvent } from '@/features/telemetry/eventService';
import { getReteachPlanForSkill } from '@/features/learn/reteachService';
import { isRoutedSkill } from '@/features/config/learningConfig';
import { inferItemPurpose, isLearnCandidate, isShadowCandidate } from '@/features/items/itemPurpose';

const QUESTIONS_PER_SESSION = 3;

interface Props {
  params: Promise<{ subjectSlug: string }>;
}

export default async function LearnPage({ params }: Props) {
  const { subjectSlug } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const user = session.user as { id: string; role?: string };
  const userId = user.id;

  const subject = await prisma.subject.findUnique({
    where: { slug: subjectSlug },
    include: {
      skills: {
        orderBy: { sortOrder: 'asc' },
        include: {
          prerequisites: true,
        },
      },
    },
  });

  if (!subject) redirect('/dashboard');

  if ((user.role ?? 'STUDENT') === 'STUDENT') {
    const baselineCompleted = await prisma.baselineSession.findFirst({
      where: { userId, subjectId: subject.id, status: 'COMPLETED' },
      select: { id: true },
    });

    if (!baselineCompleted) {
      redirect(`/baseline/${subjectSlug}`);
    }
  }

  const skillIds = subject.skills.map((s) => s.id);

  const masteries = await prisma.skillMastery.findMany({
    where: { userId, skillId: { in: skillIds } },
  });

  const now = new Date();
  const masteryMap = new Map(
    masteries.map((m) => [
      m.skillId,
      { skillId: m.skillId, mastery: m.mastery, confirmedCount: m.confirmedCount, nextReviewAt: m.nextReviewAt },
    ])
  );

  const prereqEdges = subject.skills.flatMap((s) =>
    s.prerequisites.map((p) => ({ skillId: s.id, prereqId: p.prereqId }))
  );

  const unlockedSkills = subject.skills.filter((s) =>
    isSkillUnlocked(s.id, prereqEdges, masteryMap) && isRoutedSkill(s.code)
  );

  if (unlockedSkills.length === 0) redirect('/dashboard');

  // Prefer skills due for review; among those pick lowest mastery
  let targetSkill = unlockedSkills.find((s) => {
    const m = masteryMap.get(s.id);
    return !m || !m.nextReviewAt;
  });

  if (!targetSkill) {
    const dueSkills = unlockedSkills.filter((s) => {
      const m = masteryMap.get(s.id);
      return m?.nextReviewAt && m.nextReviewAt <= now;
    });
    const pool = dueSkills.length > 0 ? dueSkills : unlockedSkills;
    const sorted = [...pool].sort((a, b) => {
      const ma = masteryMap.get(a.id)?.mastery ?? 0;
      const mb = masteryMap.get(b.id)?.mastery ?? 0;
      return ma - mb;
    });
    targetSkill = sorted[0];
  }

  if (!targetSkill) redirect('/dashboard');

  const routeDecision = await selectExplanationRoute(
    userId,
    subject.id,
    targetSkill.id,
    targetSkill.code
  );

  const itemSkills = await prisma.itemSkill.findMany({
    where: { skillId: targetSkill.id },
    include: { item: true },
  });

  const allItems = itemSkills.map((entry) => entry.item);
  const shuffledPool = [...allItems].sort(() => Math.random() - 0.5);
  const learnItems = shuffledPool.filter((item) =>
    isLearnCandidate({
      question: item.question,
      type: item.type,
      options: item.options,
      answer: item.answer,
    })
  );
  const routeShadowItems = shuffledPool.filter((item) =>
    isShadowCandidate(
      {
        question: item.question,
        type: item.type,
        options: item.options,
        answer: item.answer,
      },
      routeDecision.routeType
    )
  );
  const otherNonOnboarding = shuffledPool.filter((item) => inferItemPurpose(item).purpose !== 'ONBOARDING');

  const selected: typeof allItems = [];
  const selectedIds = new Set<string>();

  function takeFrom(pool: typeof allItems, maxToAdd: number) {
    let added = 0;
    for (const item of pool) {
      if (selected.length >= QUESTIONS_PER_SESSION || added >= maxToAdd) return;
      if (selectedIds.has(item.id)) continue;
      selected.push(item);
      selectedIds.add(item.id);
      added += 1;
    }
  }

  if (isRoutedSkill(targetSkill.code) && routeShadowItems.length >= 2) {
    takeFrom(learnItems, 1);
    takeFrom(routeShadowItems, QUESTIONS_PER_SESSION);
  } else {
    takeFrom(learnItems, QUESTIONS_PER_SESSION);
  }

  takeFrom(otherNonOnboarding, QUESTIONS_PER_SESSION);
  takeFrom(shuffledPool, QUESTIONS_PER_SESSION);

  const items = selected.slice(0, QUESTIONS_PER_SESSION);
  const gamification = await getUserGamificationSummary(userId);

  await emitEvent({
    name: 'explanation_route_assigned',
    actorUserId: userId,
    studentUserId: userId,
    subjectId: subject.id,
    skillId: targetSkill.id,
    payload: {
      skillId: targetSkill.id,
      skillCode: targetSkill.code,
      routeType: routeDecision.routeType,
      reason: routeDecision.reason,
      source: routeDecision.source,
      interventionRecommended: routeDecision.interventionRecommended ?? false,
      secureFastPass: routeDecision.secureFastPass ?? false,
      transferSignalPositive: routeDecision.transferSignalPositive ?? false,
    },
  });

  if (routeDecision.interventionRecommended) {
    await emitEvent({
      name: 'intervention_flagged',
      actorUserId: userId,
      studentUserId: userId,
      subjectId: subject.id,
      skillId: targetSkill.id,
      payload: {
        skillId: targetSkill.id,
        skillCode: targetSkill.code,
        reason: 'Fallback chain exhausted after repeated shadow failures',
      },
    });
  }

  const reteachPlan = await getReteachPlanForSkill(targetSkill.id, routeDecision.routeType);

  return (
    <LearnSession
      subject={subject}
      skill={targetSkill}
      items={items}
      userId={userId}
      gamification={gamification}
      routeType={routeDecision.routeType}
      reteachPlan={reteachPlan}
    />
  );
}
