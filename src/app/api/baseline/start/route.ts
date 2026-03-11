import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/features/auth/authOptions';
import { prisma } from '@/db/prisma';
import { emitEvent } from '@/features/telemetry/eventService';
import { isOnboardingCandidate } from '@/features/items/itemPurpose';

const schema = z.object({
  subjectSlug: z.string(),
  itemsPerSkill: z.number().int().min(1).max(3).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { subjectSlug, itemsPerSkill = 1 } = parsed.data;
  const subject = await prisma.subject.findUnique({ where: { slug: subjectSlug } });
  if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });

  const existing = await prisma.baselineSession.findFirst({
    where: { userId, subjectId: subject.id, status: 'IN_PROGRESS' },
  });

  if (existing) {
    return NextResponse.json({ sessionId: existing.id, resumed: true, payload: existing.payload });
  }

  const skills = await prisma.skill.findMany({
    where: { subjectId: subject.id },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      items: {
        select: { itemId: true, item: { select: { id: true, question: true, type: true, options: true } } },
      },
    },
  });

  const planned = skills.flatMap((s) => {
    const prioritized = [...s.items].sort((a, b) => {
      const aCandidate = isOnboardingCandidate({
        question: a.item.question,
        type: a.item.type,
        options: a.item.options,
        answer: '',
      });
      const bCandidate = isOnboardingCandidate({
        question: b.item.question,
        type: b.item.type,
        options: b.item.options,
        answer: '',
      });

      if (aCandidate !== bCandidate) return aCandidate ? -1 : 1;
      return a.item.question.localeCompare(b.item.question);
    });

    return prioritized.slice(0, itemsPerSkill).map((i) => ({
      itemId: i.itemId,
      skillId: s.id,
      skillCode: s.code,
      skillName: s.name,
      question: i.item.question,
      type: i.item.type,
      options: i.item.options,
    }));
  });

  const minItems = Math.min(12, Math.max(6, skills.length));
  const maxItems = Math.min(Math.max(minItems, planned.length), 36);
  const confidenceTarget = 0.75;

  const baselineSession = await prisma.baselineSession.create({
    data: {
      userId,
      subjectId: subject.id,
      maxItems,
      payload: {
        subjectSlug,
        plannedItems: planned,
        minItems,
        maxItems,
        confidenceTarget,
      },
    },
  });

  await emitEvent({
    name: 'baseline_started',
    actorUserId: userId,
    studentUserId: userId,
    subjectId: subject.id,
    payload: {
      sessionId: baselineSession.id,
      subjectSlug,
      plannedItems: planned.length,
    },
  });

  return NextResponse.json({
    sessionId: baselineSession.id,
    resumed: false,
    plannedItems: planned,
    maxItems,
    minItems,
    confidenceTarget,
  });
}
