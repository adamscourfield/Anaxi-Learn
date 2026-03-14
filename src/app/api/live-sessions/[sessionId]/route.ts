import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/features/auth/authOptions';
import { prisma } from '@/db/prisma';

const schema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED']),
});

interface Props {
  params: Promise<{ sessionId: string }>;
}

export async function PATCH(req: NextRequest, { params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== 'TEACHER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = (session.user as { id: string }).id;
  const { sessionId } = await params;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const { status } = parsed.data;

  const liveSession = await prisma.liveSession.findUnique({ where: { id: sessionId } });
  if (!liveSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (liveSession.teacherUserId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const now = new Date();
  const updateData: {
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
    startedAt?: Date;
    endedAt?: Date;
  } = { status };

  if (status === 'ACTIVE' && !liveSession.startedAt) {
    updateData.startedAt = now;
  }

  if (status === 'COMPLETED') {
    updateData.endedAt = now;
  }

  const updated = await prisma.liveSession.update({
    where: { id: sessionId },
    data: updateData,
  });

  return NextResponse.json(updated);
}
