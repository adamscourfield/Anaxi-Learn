import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { prisma } from '@/db/prisma';
import { z } from 'zod';
import { gradeAttempt } from '@/features/learn/gradeAttempt';
import { emitEvent } from '@/features/telemetry/eventService';
import { updatePayloadAfterAttempt } from '@/features/diagnostic/diagnosticService';
import { parseItemOptions } from '@/features/items/itemMeta';
import { decideN1Route } from '@/features/diagnostic/n1Routing';

const submitSchema = z.object({
  sessionId: z.string(),
  itemId: z.string(),
  skillId: z.string(),
  subjectId: z.string(),
  skillCode: z.string(),
  strand: z.string(),
  answer: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const body = await req.json();
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { sessionId, itemId, skillId, subjectId, skillCode, strand, answer } = parsed.data;

  const diagSession = await prisma.diagnosticSession.findUnique({ where: { id: sessionId } });
  if (!diagSession || diagSession.userId !== userId || diagSession.status !== 'IN_PROGRESS') {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  const correct = gradeAttempt(item.answer, answer);

  const attempt = await prisma.attempt.create({
    data: { userId, itemId, answer, correct, sessionId, mode: 'DIAGNOSTIC' },
  });

  const currentPayload = diagSession.payload as unknown as Parameters<typeof updatePayloadAfterAttempt>[0];
  const parsedOptions = parseItemOptions(item.options);

  const updatedPayload = updatePayloadAfterAttempt(currentPayload, skillCode, strand, correct, {
    misconceptionTag: parsedOptions.meta.misconceptionTag,
    isTransfer: parsedOptions.meta.questionRole === 'transfer' || parsedOptions.meta.transferLevel !== 'none',
  });

  let routeDecision:
    | { status: 'secure' | 'route'; route?: 'A' | 'B' | 'C'; reason: string }
    | undefined;

  if (skillCode === 'N1.1') {
    const est = updatedPayload.estimates[skillCode];
    const signals = updatedPayload.skillSignals?.[skillCode];
    if (est) {
      routeDecision = decideN1Route({
        total: est.total,
        correct: est.correct,
        transferCorrect: signals?.transferCorrect ?? false,
        misconceptionCounts: (signals?.misconceptionCounts ?? {}) as {
          pv_m1_place_vs_value?: number;
          pv_m2_zero_shift?: number;
          pv_m3_reading_direction?: number;
          pv_m4_separator_noise?: number;
        },
      });

      updatedPayload.routeRecommendations = {
        ...(updatedPayload.routeRecommendations ?? {}),
        [skillCode]: routeDecision,
      };
    }
  }

  await prisma.diagnosticSession.update({
    where: { id: sessionId },
    data: { payload: updatedPayload as object, itemsSeen: { increment: 1 } },
  });

  await emitEvent({
    name: 'attempt_submitted',
    actorUserId: userId,
    studentUserId: userId,
    subjectId,
    skillId,
    itemId,
    payload: { itemId, answer, skillId, skillCode, strand, subjectId, mode: 'DIAGNOSTIC', diagnosticSessionId: sessionId },
  });

  await emitEvent({
    name: 'attempt_graded',
    actorUserId: userId,
    studentUserId: userId,
    subjectId,
    skillId,
    itemId,
    attemptId: attempt.id,
    payload: { itemId, attemptId: attempt.id, correct, skillId, skillCode, strand, subjectId, mode: 'DIAGNOSTIC', diagnosticSessionId: sessionId },
  });

  if (routeDecision) {
    await emitEvent({
      name: 'diagnostic_route_recommended',
      actorUserId: userId,
      studentUserId: userId,
      subjectId,
      skillId,
      itemId,
      attemptId: attempt.id,
      payload: {
        skillCode,
        status: routeDecision.status,
        route: routeDecision.route ?? null,
        reason: routeDecision.reason,
        diagnosticSessionId: sessionId,
      },
    });
  }

  return NextResponse.json({ correct, routeRecommendation: routeDecision ?? null });
}
