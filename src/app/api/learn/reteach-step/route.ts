import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { z } from 'zod';
import { emitEvent } from '@/features/telemetry/eventService';
import { prisma } from '@/db/prisma';

const schema = z.object({
  subjectId: z.string(),
  skillId: z.string(),
  routeType: z.enum(['A', 'B', 'C']),
  stepIndex: z.number().int().nonnegative(),
  stepTitle: z.string(),
  correct: z.boolean(),
  retryCount: z.number().int().nonnegative(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
  alternativeShown: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { subjectId, skillId, routeType, stepIndex, stepTitle, correct, retryCount, confidence, alternativeShown } = parsed.data;

  await emitEvent({
    name: 'step_checkpoint_attempted',
    actorUserId: userId,
    studentUserId: userId,
    subjectId,
    skillId,
    payload: { routeType, stepIndex, stepTitle, correct, retryCount, confidence: confidence ?? 'medium' },
  });

  if (correct) {
    await emitEvent({
      name: 'step_checkpoint_mastered',
      actorUserId: userId,
      studentUserId: userId,
      subjectId,
      skillId,
      payload: { routeType, stepIndex, stepTitle, retryCount, confidence: confidence ?? 'medium' },
    });
  }

  if (alternativeShown) {
    await emitEvent({
      name: 'step_alternative_shown',
      actorUserId: userId,
      studentUserId: userId,
      subjectId,
      skillId,
      payload: { routeType, stepIndex, stepTitle, retryCount, confidence: confidence ?? 'medium' },
    });
  }

  // Auto-flag intervention when repeated reteach-step failure persists over time
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const repeatedStepFailures = await prisma.event.count({
    where: {
      name: 'step_checkpoint_attempted',
      studentUserId: userId,
      subjectId,
      skillId,
      createdAt: { gte: sevenDaysAgo },
    },
  });

  if (!correct && repeatedStepFailures >= 12) {
    await emitEvent({
      name: 'intervention_flagged',
      actorUserId: userId,
      studentUserId: userId,
      subjectId,
      skillId,
      payload: {
        skillId,
        reason: 'Repeated reteach-step failure pattern in 7-day window',
      },
    });
  }

  return NextResponse.json({ ok: true });
}
