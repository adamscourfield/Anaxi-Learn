import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/features/auth/authOptions';
import { prisma } from '@/db/prisma';
import { emitEvent } from '@/features/telemetry/eventService';

const schema = z.object({
  sessionId: z.string(),
  subjectSlug: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { sessionId, subjectSlug } = parsed.data;
  const baseline = await prisma.baselineSession.findUnique({ where: { id: sessionId } });
  if (!baseline || baseline.userId !== userId || baseline.status !== 'IN_PROGRESS') {
    return NextResponse.json({ error: 'Baseline session not found' }, { status: 404 });
  }

  const attempts = await prisma.baselineAttempt.findMany({
    where: { baselineSessionId: sessionId },
    include: { skill: { select: { id: true } } },
  });

  const bySkill = new Map<string, { total: number; correct: number }>();
  for (const a of attempts) {
    const row = bySkill.get(a.skillId) ?? { total: 0, correct: 0 };
    row.total += 1;
    if (a.correct) row.correct += 1;
    bySkill.set(a.skillId, row);
  }

  const seededAt = new Date();
  let seededSkills = 0;
  for (const [skillId, stats] of bySkill.entries()) {
    const mastery = stats.total > 0 ? stats.correct / stats.total : 0;
    const nextReviewAt = new Date(seededAt.getTime() + (mastery >= 0.8 ? 7 : mastery >= 0.5 ? 3 : 1) * 24 * 60 * 60 * 1000);

    await prisma.skillMastery.upsert({
      where: { userId_skillId: { userId, skillId } },
      update: {
        mastery,
        confirmedCount: mastery >= 0.85 ? 1 : 0,
        lastPracticedAt: seededAt,
        nextReviewAt,
      },
      create: {
        userId,
        skillId,
        mastery,
        confirmedCount: mastery >= 0.85 ? 1 : 0,
        lastPracticedAt: seededAt,
        nextReviewAt,
      },
    });
    seededSkills += 1;
  }

  await prisma.baselineSession.update({
    where: { id: sessionId },
    data: {
      status: 'COMPLETED',
      completedAt: seededAt,
      payload: {
        ...(baseline.payload as object),
        baselineProfile: Object.fromEntries(
          Array.from(bySkill.entries()).map(([skillId, s]) => [
            skillId,
            { total: s.total, correct: s.correct, mastery: s.total > 0 ? s.correct / s.total : 0 },
          ])
        ),
      },
    },
  });

  await emitEvent({
    name: 'baseline_completed',
    actorUserId: userId,
    studentUserId: userId,
    subjectId: baseline.subjectId,
    payload: {
      sessionId,
      subjectSlug,
      itemsSeen: attempts.length,
      seededSkills,
    },
  });

  return NextResponse.json({ ok: true, seededSkills, itemsSeen: attempts.length });
}
