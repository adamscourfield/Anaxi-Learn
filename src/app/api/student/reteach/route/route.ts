import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/features/auth/authOptions';
import { createReteachRoute } from '@/features/reteach/studentReteach';

const schema = z.object({
  subjectId: z.string().min(1),
  skillId: z.string().min(1),
  routeType: z.enum(['A', 'B', 'C']).default('A'),
  checkpointAccuracy: z.number().min(0).max(1).optional(),
  wrongFirstDifferenceRate: z.number().min(0).max(1).optional(),
  interactionPassRate: z.number().min(0).max(1).optional(),
  dleTrend: z.number().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });
  }

  const userId = (session.user as { id: string }).id;
  const route = await createReteachRoute({ userId, ...parsed.data });

  return NextResponse.json(route);
}
