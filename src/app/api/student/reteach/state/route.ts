import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/features/auth/authOptions';
import { getReteachState } from '@/features/reteach/studentReteach';

const schema = z.object({
  subjectId: z.string().min(1),
  skillId: z.string().min(1),
  assignedPathId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', issues: parsed.error.issues }, { status: 400 });
  }

  const userId = (session.user as { id: string }).id;
  const state = await getReteachState({ userId, ...parsed.data });

  return NextResponse.json(state);
}
