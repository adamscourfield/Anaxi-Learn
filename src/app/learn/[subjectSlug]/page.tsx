import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import { prisma } from '@/db/prisma';
import { LearnSession } from '@/features/learn/LearnSession';
import { hasCompletedOnboardingDiagnostic } from '@/features/learn/onboarding';
import { selectNextSkill } from '@/features/learn/nextSkill';

const QUESTIONS_PER_SESSION = 3;

interface Props {
  params: Promise<{ subjectSlug: string }>;
}

export default async function LearnPage({ params }: Props) {
  const { subjectSlug } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const userId = (session.user as { id: string }).id;

  const subject = await prisma.subject.findUnique({
    where: { slug: subjectSlug },
    include: {
      skills: {
        orderBy: { sortOrder: 'asc' },
        include: {
          prerequisites: true,
        },
      },
    },
  });

  if (!subject) redirect('/dashboard');
  const onboardingComplete = await hasCompletedOnboardingDiagnostic(userId, subject.id);
  if (!onboardingComplete) redirect(`/diagnostic/${subjectSlug}`);

  const skillIds = subject.skills.map((s) => s.id);

  const masteries = await prisma.skillMastery.findMany({
    where: { userId, skillId: { in: skillIds } },
  });

  const targetSkill = selectNextSkill(subject.skills, masteries, new Date());

  if (!targetSkill) redirect('/dashboard');

  const itemSkills = await prisma.itemSkill.findMany({
    where: { skillId: targetSkill.id },
    include: {
      item: {
        include: {
          attempts: {
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  const items = itemSkills
    .map((record) => record.item)
    .sort((a, b) => {
      const aAttempt = a.attempts[0]?.createdAt?.getTime() ?? 0;
      const bAttempt = b.attempts[0]?.createdAt?.getTime() ?? 0;
      if (a.attempts.length === 0 && b.attempts.length > 0) return -1;
      if (b.attempts.length === 0 && a.attempts.length > 0) return 1;
      return aAttempt - bAttempt;
    })
    .slice(0, QUESTIONS_PER_SESSION)
    .map(({ attempts, ...item }) => item);

  return (
    <LearnSession
      subject={subject}
      skill={targetSkill}
      items={items}
      userId={userId}
    />
  );
}
