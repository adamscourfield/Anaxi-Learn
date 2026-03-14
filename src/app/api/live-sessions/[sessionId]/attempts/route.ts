import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/features/auth/authOptions';
import { prisma } from '@/db/prisma';
import { recordKnowledgeAttempt } from '@/features/knowledge-state/knowledgeStateService';

const schema = z.object({
  itemId: z.string().min(1),
  skillId: z.string().min(1),
  answer: z.string().min(1),
  responseTimeMs: z.number().int().min(0),
});

interface Props {
  params: Promise<{ sessionId: string }>;
}

export async function POST(req: NextRequest, { params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== 'STUDENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = (session.user as { id: string }).id;
  const { sessionId } = await params;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { itemId, skillId, answer, responseTimeMs } = parsed.data;

  // Verify student is a participant in this session
  const participant = await prisma.liveParticipant.findUnique({
    where: {
      liveSessionId_studentUserId: {
        liveSessionId: sessionId,
        studentUserId: userId,
      },
    },
  });

  if (!participant) return NextResponse.json({ error: 'Not a participant in this session' }, { status: 403 });

  const liveSession = await prisma.liveSession.findUnique({ where: { id: sessionId } });
  if (!liveSession || liveSession.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Session is not active' }, { status: 400 });
  }

  // Look up the item and check correctness
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  const correct = item.answer.trim().toLowerCase() === answer.trim().toLowerCase();

  // Create LiveAttempt record
  await prisma.liveAttempt.create({
    data: {
      liveSessionId: sessionId,
      studentUserId: userId,
      itemId,
      skillId,
      answer,
      correct,
      responseTimeMs,
    },
  });

  // Update knowledge state via knowledge state service
  await recordKnowledgeAttempt({
    userId,
    skillId,
    itemId,
    correct,
    responseTimeMs,
  });

  // Find next unanswered item for this student in this session
  const answeredItemIds = await prisma.liveAttempt.findMany({
    where: { liveSessionId: sessionId, studentUserId: userId },
    select: { itemId: true },
  });
  const answeredSet = new Set(answeredItemIds.map((a) => a.itemId));

  const sessionSkillId = liveSession.skillId ?? skillId;
  const nextItem = await prisma.item.findFirst({
    where: {
      id: { notIn: Array.from(answeredSet) },
      skills: {
        some: { skillId: sessionSkillId },
      },
    },
    select: {
      id: true,
      question: true,
      type: true,
      options: true,
    },
  });

  return NextResponse.json({
    correct,
    nextItem: nextItem
      ? {
          id: nextItem.id,
          question: nextItem.question,
          type: nextItem.type,
          options: nextItem.options,
        }
      : null,
  });
}
