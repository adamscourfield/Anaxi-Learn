import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/features/auth/authOptions';
import { recordReteachAttempt } from '@/features/reteach/studentReteach';

const schema = z.object({
  subjectId: z.string().min(1),
  skillId: z.string().min(1),
  assignedPathId: z.string().min(1),
  step: z.enum(['TEACH', 'GUIDED', 'INDEPENDENT', 'RETRIEVAL']),
  stepIndex: z.number().int().nonnegative().default(0),
  correct: z.boolean(),
  supportLevel: z.enum(['INDEPENDENT', 'LIGHT_PROMPT', 'WORKED_EXAMPLE', 'SCAFFOLDED', 'FULL_EXPLANATION']).optional(),
  isDelayedRetrieval: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', issues: parsed.error.issues }, { status: 400 });
  }

  const userId = (session.user as { id: string }).id;
  await recordReteachAttempt({ userId, ...parsed.data });

  return NextResponse.json({ ok: true });
}
