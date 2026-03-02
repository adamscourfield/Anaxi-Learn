import { prisma } from '@/db/prisma';
import { emitEvent } from '@/features/telemetry/eventService';
import { calculateMastery, scheduleNextReview, MASTERY_STABLE_THRESHOLD } from './masteryService';

export async function updateSkillMastery(
  userId: string,
  skillId: string,
  subjectId: string,
  correctAnswers: number,
  total: number
): Promise<void> {
  const mastery = calculateMastery(correctAnswers, total);
  const now = new Date();

  const existing = await prisma.skillMastery.findUnique({
    where: { userId_skillId: { userId, skillId } },
    select: { confirmedCount: true, streak: true },
  });

  const prevConfirmedCount = existing?.confirmedCount ?? 0;
  const prevStreak = existing?.streak ?? 0;

  const newStreak = mastery >= MASTERY_STABLE_THRESHOLD ? prevStreak + 1 : 0;
  const newConfirmedCount =
    mastery >= MASTERY_STABLE_THRESHOLD
      ? Math.min(prevConfirmedCount + 1, 2)
      : 0;

  const nextReviewAt = scheduleNextReview(mastery, newConfirmedCount, now);

  await prisma.skillMastery.upsert({
    where: { userId_skillId: { userId, skillId } },
    update: {
      mastery,
      streak: newStreak,
      confirmedCount: newConfirmedCount,
      lastPracticedAt: now,
      nextReviewAt,
    },
    create: {
      userId,
      skillId,
      mastery,
      streak: newStreak,
      confirmedCount: newConfirmedCount,
      lastPracticedAt: now,
      nextReviewAt,
    },
  });

  const skill = await prisma.skill.findUnique({
    where: { id: skillId },
    select: { code: true, strand: true },
  });

  const skillCode = skill?.code ?? skillId;
  const strand = skill?.strand ?? '';

  await emitEvent({
    name: 'skill_state_updated',
    actorUserId: userId,
    studentUserId: userId,
    subjectId,
    skillId,
    payload: {
      skillId,
      skillCode,
      strand,
      mastery,
      confirmedCount: newConfirmedCount,
      lastPracticedAt: now.toISOString(),
      nextReviewAt: nextReviewAt.toISOString(),
    },
  });

  await emitEvent({
    name: 'review_scheduled',
    actorUserId: userId,
    studentUserId: userId,
    subjectId,
    skillId,
    payload: {
      skillId,
      skillCode,
      strand,
      nextReviewAt: nextReviewAt.toISOString(),
    },
  });
}
