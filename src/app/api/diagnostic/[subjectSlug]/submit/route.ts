import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { prisma } from '@/db/prisma';
import { z } from 'zod';
import { gradeAttempt } from '@/features/learn/gradeAttempt';
import { emitEvent } from '@/features/telemetry/eventService';
import { updatePayloadAfterAttempt } from '@/features/diagnostic/diagnosticService';
import { grantReward } from '@/features/gamification/gamificationService';
import { inferN11MisconceptionTag } from '@/features/diagnostic/misconceptions';

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
  const misconceptionTag = inferN11MisconceptionTag(
    skillCode,
    answer,
    (item.options as string[]) ?? [],
    correct
  );

  const attempt = await prisma.attempt.create({
    data: { userId, itemId, answer, correct, sessionId, mode: 'DIAGNOSTIC' },
  });

  const currentPayload = diagSession.payload as unknown as Parameters<typeof updatePayloadAfterAttempt>[0];
  const updatedPayload = updatePayloadAfterAttempt(
    currentPayload,
    skillCode,
    strand,
    correct
  );

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
    payload: { itemId, answer, skillId, skillCode, strand, subjectId, mode: 'DIAGNOSTIC', diagnosticSessionId: sessionId, misconceptionTag },
  });

  await emitEvent({
    name: 'attempt_graded',
    actorUserId: userId,
    studentUserId: userId,
    subjectId,
    skillId,
    itemId,
    attemptId: attempt.id,
    payload: { itemId, attemptId: attempt.id, correct, skillId, skillCode, strand, subjectId, mode: 'DIAGNOSTIC', diagnosticSessionId: sessionId, misconceptionTag },
  });

  await emitEvent({
    name: 'question_answered',
    actorUserId: userId,
    studentUserId: userId,
    subjectId,
    skillId,
    itemId,
    attemptId: attempt.id,
    payload: { itemId, skillId, subjectId, correct, mode: 'DIAGNOSTIC' },
  });

  await grantReward(userId, subjectId, correct ? 'diagnostic_item_correct' : 'diagnostic_item_incorrect', {
    itemId,
    skillId,
    mode: 'DIAGNOSTIC',
  });

  return NextResponse.json({ correct });
}
