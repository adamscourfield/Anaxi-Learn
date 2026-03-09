import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/features/auth/authOptions';
import { prisma } from '@/db/prisma';
import { evaluateBaselineStop, selectNextSkill, type BaselineSkillProgress } from '@/features/baseline/baselineService';

const schema = z.object({
  sessionId: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { sessionId } = parsed.data;
  const baseline = await prisma.baselineSession.findUnique({ where: { id: sessionId } });
  if (!baseline || baseline.userId !== userId || baseline.status !== 'IN_PROGRESS') {
    return NextResponse.json({ error: 'Baseline session not found' }, { status: 404 });
  }

  const payload = (baseline.payload as Record<string, unknown>) ?? {};
  const minItems = Number(payload.minItems ?? 12);
  const maxItems = Number(payload.maxItems ?? baseline.maxItems ?? 24);
  const confidenceTarget = Number(payload.confidenceTarget ?? 0.75);

  const skills = await prisma.skill.findMany({
    where: { subjectId: baseline.subjectId },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      code: true,
      sortOrder: true,
      items: { select: { itemId: true } },
    },
  });

  const attempts = await prisma.baselineAttempt.findMany({
    where: { baselineSessionId: sessionId },
    select: { itemId: true, skillId: true, correct: true },
  });

  const attemptedBySkill = new Map<string, { attempts: number; correct: number; seen: Set<string> }>();
  for (const a of attempts) {
    const row = attemptedBySkill.get(a.skillId) ?? { attempts: 0, correct: 0, seen: new Set<string>() };
    row.attempts += 1;
    if (a.correct) row.correct += 1;
    row.seen.add(a.itemId);
    attemptedBySkill.set(a.skillId, row);
  }

  const progress: BaselineSkillProgress[] = skills.map((s) => {
    const stat = attemptedBySkill.get(s.id) ?? { attempts: 0, correct: 0, seen: new Set<string>() };
    const remainingItemIds = s.items.map((i) => i.itemId).filter((id) => !stat.seen.has(id));
    return {
      skillId: s.id,
      skillCode: s.code,
      sortOrder: s.sortOrder,
      attempts: stat.attempts,
      correct: stat.correct,
      accuracy: stat.attempts > 0 ? stat.correct / stat.attempts : 0,
      remainingItemIds,
    };
  });

  const stop = evaluateBaselineStop({
    itemsSeen: attempts.length,
    minItems,
    maxItems,
    confidenceTarget,
    skillProgress: progress,
  });

  if (stop.shouldStop) {
    return NextResponse.json({ done: true, reason: stop.reason, itemsSeen: attempts.length });
  }

  const nextSkill = selectNextSkill(progress);
  if (!nextSkill || nextSkill.remainingItemIds.length === 0) {
    return NextResponse.json({ done: true, reason: 'item_pool_exhausted', itemsSeen: attempts.length });
  }

  const item = await prisma.item.findUnique({
    where: { id: nextSkill.remainingItemIds[0] },
    select: { id: true, question: true, type: true, options: true },
  });

  if (!item) {
    return NextResponse.json({ done: true, reason: 'item_not_found', itemsSeen: attempts.length });
  }

  return NextResponse.json({
    done: false,
    item: {
      id: item.id,
      question: item.question,
      type: item.type,
      options: item.options,
      skillId: nextSkill.skillId,
      skillCode: nextSkill.skillCode,
    },
    itemsSeen: attempts.length,
    maxItems,
    reason: stop.reason,
  });
}
