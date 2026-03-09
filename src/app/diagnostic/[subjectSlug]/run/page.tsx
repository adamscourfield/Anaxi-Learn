import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/db/prisma';
import { initPayload, shouldStopEarly, selectNextSkill } from '@/features/diagnostic/diagnosticService';
import { DiagnosticRunClient } from '@/features/diagnostic/DiagnosticRunClient';
import { LEARNING_CONFIG, isRoutedSkill } from '@/features/config/learningConfig';

interface Props {
  params: Promise<{ subjectSlug: string }>;
}

export default async function DiagnosticRunPage({ params }: Props) {
  const { subjectSlug } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const userId = (session.user as { id: string }).id;

  const subject = await prisma.subject.findUnique({
    where: { slug: subjectSlug },
    include: {
      skills: {
        orderBy: { sortOrder: 'asc' },
        include: { prerequisites: true, items: { include: { item: true } } },
      },
    },
  });
  if (!subject) notFound();

  // Get or create diagnostic session
  let diagSession = await prisma.diagnosticSession.findFirst({
    where: { userId, subjectId: subject.id, status: 'IN_PROGRESS' },
  });

  if (!diagSession) {
    diagSession = await prisma.diagnosticSession.create({
      data: { userId, subjectId: subject.id, payload: initPayload() as object },
    });
  }

  const payload = diagSession.payload as unknown as ReturnType<typeof initPayload>;

  // Check if we should stop
  if (shouldStopEarly(payload, diagSession.itemsSeen, diagSession.minItems, diagSession.maxItems, diagSession.confidenceTarget)) {
    redirect(`/diagnostic/${subjectSlug}/complete?sessionId=${diagSession.id}`);
  }

  // Select next skill - configurable diagnostic strands
  const availableSkills = subject.skills
    .filter((s) => LEARNING_CONFIG.diagnosticStrands.includes(s.strand.toUpperCase()))
    .filter((s) => isRoutedSkill(s.code))
    .map((s) => ({ id: s.id, code: s.code, strand: s.strand }));

  const nextSkill = selectNextSkill(availableSkills, payload);
  if (!nextSkill) {
    redirect(`/diagnostic/${subjectSlug}/complete?sessionId=${diagSession.id}`);
  }

  // Get a skill item not yet seen in this session (check attempts)
  const seenAttempts = await prisma.attempt.findMany({
    where: { userId, sessionId: diagSession.id },
    select: { itemId: true },
  });
  const seenItemIds = new Set(seenAttempts.map((a) => a.itemId));

  const fullSkill = subject.skills.find((s) => s.id === nextSkill.id);
  if (!fullSkill) redirect(`/diagnostic/${subjectSlug}/complete?sessionId=${diagSession.id}`);

  const availableItems = fullSkill.items
    .map((is) => is.item)
    .filter((item) => !seenItemIds.has(item.id));

  const preferred = availableItems.filter((item) => {
    if (item.question.startsWith('[')) return false;
    if (nextSkill.code === 'N1.1') return item.question.startsWith('N1.1 DQ');
    if (nextSkill.code === 'N1.2') return item.question.startsWith('N1.2 DQ');
    if (nextSkill.code === 'N1.3') return item.question.startsWith('N1.3 DQ');
    return true;
  });

  const pickRandom = <T,>(arr: T[]): T | undefined => (arr.length ? arr[Math.floor(Math.random() * arr.length)] : undefined);

  const nextItem =
    pickRandom(preferred) ??
    pickRandom(availableItems.filter((candidate) => !candidate.question.startsWith('['))) ??
    pickRandom(availableItems) ??
    fullSkill.items[0]?.item;

  if (!nextItem) {
    redirect(`/diagnostic/${subjectSlug}/complete?sessionId=${diagSession.id}`);
  }

  return (
    <DiagnosticRunClient
      subject={{ id: subject.id, title: subject.title, slug: subject.slug }}
      skill={{ id: nextSkill.id, code: nextSkill.code, name: fullSkill.name, strand: nextSkill.strand }}
      item={{
        id: nextItem.id,
        question: nextItem.question,
        options: nextItem.options,
        type: nextItem.type,
      }}
      sessionId={diagSession.id}
      itemsSeen={diagSession.itemsSeen}
      maxItems={diagSession.maxItems}
      subjectSlug={subjectSlug}
    />
  );
}
