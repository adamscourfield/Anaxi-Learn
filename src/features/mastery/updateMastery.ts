import { prisma } from '@/db/prisma';
import { emitEvent } from '@/features/telemetry/eventService';
import { calculateMastery, scheduleNextReview } from './masteryService';

export async function updateSkillMastery(
  userId: string,
  skillId: string,
  subjectId: string,
  correctAnswers: number,
  total: number
): Promise<void> {
  const mastery = calculateMastery(correctAnswers, total);
  const now = new Date();
  const nextReviewAt = scheduleNextReview(now);

  await prisma.skillMastery.upsert({
    where: { userId_skillId: { userId, skillId } },
    update: {
      mastery,
      lastPracticedAt: now,
      nextReviewAt,
    },
    create: {
      userId,
      skillId,
      mastery,
      lastPracticedAt: now,
      nextReviewAt,
    },
  });

  await emitEvent({
    name: 'skill_state_updated',
    actorUserId: userId,
    studentUserId: userId,
    subjectId,
    skillId,
    payload: {
      skillId,
      mastery,
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
      nextReviewAt: nextReviewAt.toISOString(),
    },
  });
}
