import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { prisma } from '@/db/prisma';
import { getPhase9Analytics } from '@/features/reteach/phase9Analytics';

export async function GET(req: NextRequest, context: { params: Promise<{ subjectSlug: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { subjectSlug } = await context.params;
  const daysParam = Number(req.nextUrl.searchParams.get('days') ?? '30');
  const days = [7, 30, 90].includes(daysParam) ? daysParam : 30;

  const subject = await prisma.subject.findUnique({ where: { slug: subjectSlug } });
  if (!subject) return NextResponse.json({ error: 'Subject not found' }, { status: 404 });

  const analytics = await getPhase9Analytics(subject.id, days);
  return NextResponse.json({ subject: { id: subject.id, slug: subject.slug, title: subject.title }, ...analytics });
}
