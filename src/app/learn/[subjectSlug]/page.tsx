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

  const itemSkills = await prisma.itemSkill.findMany({
    where: { skillId: targetSkill.id },
    include: { item: true },
  });

  const realItems = itemSkills
    .map((is) => is.item)
    .filter((item) => !item.question.startsWith('['));

  const pool = realItems.length > 0 ? realItems : itemSkills.map((is) => is.item);
  const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
  const items = shuffledPool.slice(0, QUESTIONS_PER_SESSION);
  const gamification = await getUserGamificationSummary(userId);

  const routeDecision = await selectExplanationRoute(
    userId,
    subject.id,
    targetSkill.id,
    targetSkill.code
  );

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
