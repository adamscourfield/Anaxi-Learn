import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { prisma } from '@/db/prisma';
import { getEffectiveReteachConfig } from '@/features/reteach/reteachPolicy';
import {
  parsePersistedReteachPolicy,
  reteachPolicyWriteSchema,
} from '@/features/reteach/reteachPolicyContract';

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

  const parsed = reteachPolicyWriteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });
  }

  const normalizedPolicy = parsePersistedReteachPolicy(parsed.data);

  await prisma.event.create({
    data: {
      name: 'reteach_policy_updated',
      actorUserId: auth.userId,
      payload: normalizedPolicy,
    },
  });

  return NextResponse.json({ ok: true, policy: normalizedPolicy });
}
