import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { prisma } from '@/db/prisma';
import { z } from 'zod';
import { gradeAttempt } from '@/features/learn/gradeAttempt';
import { emitEvent } from '@/features/telemetry/eventService';
import { updateSkillMastery } from '@/features/mastery/updateMastery';
import { parseItemOptions } from '@/features/items/itemMeta';

const attemptSchema = z.object({
  itemId: z.string(),
  skillId: z.string(),
  subjectId: z.string(),
  answer: z.string(),
  isLast: z.boolean(),
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

  const { itemId, skillId, subjectId, answer, isLast, totalItems, previousResults } = parsed.data;

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  const correct = gradeAttempt(item.answer, answer);

  const attempt = await prisma.attempt.create({
    data: { userId, itemId, answer, correct },
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

  // N1.1 shadow gate events (route-level pass/fail) for richer routing telemetry
  const parsedItemOptions = parseItemOptions(item.options);
  if (parsedItemOptions.meta.questionRole === 'shadow' && parsedItemOptions.meta.route) {
    const recentSkillAttempts = await prisma.attempt.findMany({
      where: {
        userId,
        item: { skills: { some: { skillId } } },
      },
      include: { item: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const recentRouteShadows = recentSkillAttempts
      .filter((a) => {
        const m = parseItemOptions(a.item.options).meta;
        return m.questionRole === 'shadow' && m.route === parsedItemOptions.meta.route;
      })
      .slice(0, 2);

    if (recentRouteShadows.length === 2) {
      const passed = recentRouteShadows.every((a) => a.correct);
      await emitEvent({
        name: passed ? 'shadow_pair_passed' : 'shadow_pair_failed',
        actorUserId: userId,
        studentUserId: userId,
        subjectId,
        skillId,
        itemId,
        attemptId: attempt.id,
        payload: {
          route: parsedItemOptions.meta.route,
          attemptIds: recentRouteShadows.map((a) => a.id),
          passed,
        },
      });

      if (!passed && parsedItemOptions.meta.route === 'C') {
        await prisma.interventionFlag.upsert({
          where: { userId_skillId: { userId, skillId } },
          update: { isResolved: false, lastSeenAt: new Date(), reason: 'N1.1 route C shadow pair failed' },
          create: { userId, subjectId, skillId, reason: 'N1.1 route C shadow pair failed' },
        });

        await emitEvent({
          name: 'intervention_flagged',
          actorUserId: userId,
          studentUserId: userId,
          subjectId,
          skillId,
          itemId,
          attemptId: attempt.id,
          payload: { reason: 'N1.1 route C shadow pair failed', route: 'C' },
        });
      }
    }
  }

  if (isLast) {
    const allResults = [...previousResults, { itemId, correct }];
    const correctCount = allResults.filter((r) => r.correct).length;

    // Detect if this is a due review
    const skillMastery = await prisma.skillMastery.findUnique({
      where: { userId_skillId: { userId, skillId } },
      select: { nextReviewAt: true },
    });
    const now = new Date();
    const isDueReview = skillMastery?.nextReviewAt != null && skillMastery.nextReviewAt <= now;
    const mode = isDueReview ? 'REVIEW' : 'PRACTICE';

    await updateSkillMastery(userId, skillId, subjectId, correctCount, totalItems, mode);
  }

  return NextResponse.json({ correct });
}
