import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { prisma } from '@/db/prisma';

interface Props {
  params: Promise<{ noteId: string }>;
}

export async function POST(_req: NextRequest, { params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as { role: string }).role;
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { noteId } = await params;
  if (!noteId) return NextResponse.json({ error: 'Missing noteId' }, { status: 400 });

  const note = await prisma.itemReviewNote.update({
    where: { id: noteId },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
    },
    include: {
      author: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({
    id: note.id,
    status: note.status,
    category: note.category,
    note: note.note,
    createdAt: note.createdAt.toISOString(),
    resolvedAt: note.resolvedAt?.toISOString() ?? null,
    authorLabel: note.author.name ?? note.author.email,
  });
}
