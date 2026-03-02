import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import { prisma } from '@/db/prisma';
import { LearnSession } from '@/features/learn/LearnSession';

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
    include: { skills: true },
  });

  if (!subject) redirect('/dashboard');

  const masteries = await prisma.skillMastery.findMany({
    where: { userId, skillId: { in: subject.skills.map((s) => s.id) } },
  });

  const now = new Date();
  const masteryMap = new Map(masteries.map((m) => [m.skillId, m]));

  let targetSkill = subject.skills.find((s) => {
    const m = masteryMap.get(s.id);
    return !m || !m.nextReviewAt || m.nextReviewAt <= now;
  });

  if (!targetSkill) {
    const sorted = [...subject.skills].sort((a, b) => {
      const ma = masteryMap.get(a.id)?.mastery ?? 0;
      const mb = masteryMap.get(b.id)?.mastery ?? 0;
      return ma - mb;
    });
    targetSkill = sorted[0];
  }

  if (!targetSkill) redirect('/dashboard');

  const itemSkills = await prisma.itemSkill.findMany({
    where: { skillId: targetSkill.id },
    include: { item: true },
    take: QUESTIONS_PER_SESSION,
  });

  const items = itemSkills.map((is) => is.item);

  return (
    <LearnSession
      subject={subject}
      skill={targetSkill}
      items={items}
      userId={userId}
    />
  );
}
