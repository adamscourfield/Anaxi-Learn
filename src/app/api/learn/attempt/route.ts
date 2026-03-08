import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { prisma } from '@/db/prisma';
import { z } from 'zod';
import { gradeAttempt } from '@/features/learn/gradeAttempt';
import { emitEvent } from '@/features/telemetry/eventService';
import { updateSkillMastery } from '@/features/mastery/updateMastery';
import { grantReward, maybeGrantDailyStreak } from '@/features/gamification/gamificationService';

const attemptSchema = z.object({
  itemId: z.string(),
  skillId: z.string(),
  subjectId: z.string(),
  answer: z.string(),
  isLast: z.boolean(),
  questionIndex: z.number().int().nonnegative().optional(),
  routeType: z.enum(['A', 'B', 'C']).optional(),
  totalItems: z.number(),
  previousResults: z.array(z.object({ itemId: z.string(), correct: z.boolean() })),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const body = await req.json();
  const parsed = attemptSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { itemId, skillId, subjectId, answer, isLast, questionIndex, routeType, totalItems, previousResults } = parsed.data;

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  const correct = gradeAttempt(item.answer, answer);

  const skillMastery = await prisma.skillMastery.findUnique({
    where: { userId_skillId: { userId, skillId } },
    select: { nextReviewAt: true },
  });
  const now = new Date();
  const isDueReview = skillMastery?.nextReviewAt != null && skillMastery.nextReviewAt <= now;
  const mode = isDueReview ? 'REVIEW' : 'PRACTICE';

  const isShadowQuestion = typeof questionIndex === 'number' && totalItems >= 2 && questionIndex >= totalItems - 2;

  const attempt = await prisma.attempt.create({
    data: { userId, itemId, answer, correct, mode },
  });

  await emitEvent({
    name: 'attempt_submitted',
    actorUserId: userId,
    studentUserId: userId,
    subjectId,
    skillId,
    itemId,
    payload: { itemId, answer, skillId, subjectId },
  });

  await emitEvent({
    name: 'attempt_graded',
    actorUserId: userId,
    studentUserId: userId,
    subjectId,
    skillId,
    itemId,
    attemptId: attempt.id,
    payload: { itemId, attemptId: attempt.id, correct, skillId, subjectId },
  });

  await emitEvent({
    name: 'question_answered',
    actorUserId: userId,
    studentUserId: userId,
    subjectId,
    skillId,
    itemId,
    attemptId: attempt.id,
    payload: { itemId, skillId, subjectId, correct, mode },
  });

  await grantReward(
    userId,
    subjectId,
    isShadowQuestion && correct ? 'shadow_item_correct' : correct ? 'diagnostic_item_correct' : 'diagnostic_item_incorrect',
    {
      itemId,
      skillId,
      mode,
      isShadowQuestion,
      routeType,
    }
  );

  const hadRecentIncorrect = await prisma.attempt.findFirst({
    where: {
      userId,
      itemId,
      correct: false,
      createdAt: { lt: attempt.createdAt },
    },
    select: { id: true },
  });

  if (correct && hadRecentIncorrect) {
    await grantReward(userId, subjectId, 'retry_recovery', { itemId, skillId, mode });
  }

  await maybeGrantDailyStreak(userId, subjectId);

  if (isLast) {
    const allResults = [...previousResults, { itemId, correct }];
    const correctCount = allResults.filter((r) => r.correct).length;
    const accuracy = totalItems > 0 ? correctCount / totalItems : 0;

    await emitEvent({
      name: 'route_completed',
      actorUserId: userId,
      studentUserId: userId,
      subjectId,
      skillId,
      payload: { skillId, subjectId, totalItems, correctCount, accuracy, routeType: routeType ?? 'A' },
    });

    await grantReward(userId, subjectId, 'route_completed', { skillId, accuracy, routeType: routeType ?? 'A' });

    const shadowPair = allResults.slice(-2);
    if (shadowPair.length === 2) {
      const shadowPassed = shadowPair.every((r) => r.correct);
      await emitEvent({
        name: shadowPassed ? 'shadow_pair_passed' : 'shadow_pair_failed',
        actorUserId: userId,
        studentUserId: userId,
        subjectId,
        skillId,
        payload: {
          skillId,
          subjectId,
          routeType: routeType ?? 'A',
          pairSize: 2,
          correctCount: shadowPair.filter((r) => r.correct).length,
        },
      });
    }

    await updateSkillMastery(userId, skillId, subjectId, correctCount, totalItems, mode);
  }

  return NextResponse.json({ correct });
}
