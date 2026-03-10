import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { prisma } from '@/db/prisma';
import { z } from 'zod';

const createReviewNoteSchema = z.object({
  itemId: z.string().min(1),
  category: z.enum([
    'ANSWER_MODE',
    'ANSWER_MAPPING',
    'STEM_COPY',
    'DISTRACTOR_QUALITY',
    'SKILL_MAPPING',
    'OTHER',
  ]),
  note: z.string().trim().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as { role: string }).role;
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const parsed = createReviewNoteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const authorUserId = (session.user as { id: string }).id;

  const note = await prisma.itemReviewNote.create({
    data: {
      itemId: parsed.data.itemId,
      authorUserId,
      category: parsed.data.category,
      note: parsed.data.note,
      status: 'OPEN',
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
