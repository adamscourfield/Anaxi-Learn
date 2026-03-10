import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/features/auth/authOptions';
import { prisma } from '@/db/prisma';
import { getEffectiveReteachConfig } from '@/features/reteach/reteachPolicy';

const schema = z.object({
  checkpointAccuracyTrigger: z.number().min(0).max(1),
  wrongFirstDifferenceTrigger: z.number().min(0).max(1),
  interactionPassTrigger: z.number().min(0).max(1),
  dleTrendTrigger: z.number().min(-1).max(1),
  gateConsecutiveIndependentCorrect: z.number().int().min(1).max(10),
  gateIndependentRateWindow: z.number().int().min(1).max(20),
  gateIndependentRateMin: z.number().min(0).max(1),
  gateEscalateAfterFailedLoops: z.number().int().min(1).max(10),
});

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const role = (session.user as { role?: string }).role;
  if (role !== 'ADMIN') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  const userId = (session.user as { id: string }).id;
  return { userId };
}

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const policy = await getEffectiveReteachConfig();
  return NextResponse.json({ policy });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });
  }

  await prisma.event.create({
    data: {
      name: 'reteach_policy_updated',
      actorUserId: auth.userId,
      payload: parsed.data,
    },
  });

  return NextResponse.json({ ok: true, policy: parsed.data });
}
