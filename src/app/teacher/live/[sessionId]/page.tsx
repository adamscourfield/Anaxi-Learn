import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import { prisma } from '@/db/prisma';
import { TeacherLiveDashboard } from './TeacherLiveDashboard';

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function TeacherLiveSessionPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const user = session.user as { id: string; role?: string };
  if (user.role !== 'TEACHER') redirect('/dashboard');

  const { sessionId } = await params;

  const liveSession = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    select: { id: true, teacherUserId: true },
  });

  if (!liveSession || liveSession.teacherUserId !== user.id) redirect('/teacher/dashboard');

  return <TeacherLiveDashboard sessionId={sessionId} />;
}
