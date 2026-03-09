import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/features/auth/authOptions';
import { prisma } from '@/db/prisma';
import { gradeAttempt, getAnswerFormatHint } from '@/features/learn/gradeAttempt';
import { emitEvent } from '@/features/telemetry/eventService';

const schema = z.object({
  sessionId: z.string(),
  itemId: z.string(),
  skillId: z.string(),
  answer: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { sessionId, itemId, skillId, answer } = parsed.data;

  const baseline = await prisma.baselineSession.findUnique({ where: { id: sessionId } });
  if (!baseline || baseline.userId !== userId || baseline.status !== 'IN_PROGRESS') {
    return NextResponse.json({ error: 'Baseline session not found' }, { status: 404 });
  }

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  const correct = gradeAttempt(item.answer, answer);

  await prisma.baselineAttempt.upsert({
    where: { baselineSessionId_itemId: { baselineSessionId: sessionId, itemId } },
    update: { answer, correct, skillId },
    create: {
      baselineSessionId: sessionId,
      userId,
      itemId,
      skillId,
      answer,
      correct,
    },
  });

  const itemsSeen = await prisma.baselineAttempt.count({ where: { baselineSessionId: sessionId } });
  await prisma.baselineSession.update({
    where: { id: sessionId },
    data: { itemsSeen },
  });

  await emitEvent({
    name: 'baseline_item_answered',
    actorUserId: userId,
    studentUserId: userId,
    subjectId: baseline.subjectId,
    skillId,
    itemId,
    payload: {
      sessionId,
      itemId,
      skillId,
      subjectId: baseline.subjectId,
      correct,
    },
  });

  return NextResponse.json({
    correct,
    hint: !correct ? getAnswerFormatHint(item.type, item.question, item.options) : null,
    itemsSeen,
  });
}
