import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/db/prisma';
import { emitEvent } from '@/features/telemetry/eventService';
import { scheduleNextReview } from '@/features/mastery/masteryService';
import Link from 'next/link';

interface Props {
  params: Promise<{ subjectSlug: string }>;
  searchParams: Promise<{ sessionId?: string }>;
}

export default async function DiagnosticCompletePage({ params, searchParams }: Props) {
  const { subjectSlug } = await params;
  const { sessionId } = await searchParams;

  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const userId = (session.user as { id: string }).id;

  const subject = await prisma.subject.findUnique({ where: { slug: subjectSlug } });
  if (!subject) notFound();

  // Find session to complete
  const diagSession = sessionId
    ? await prisma.diagnosticSession.findUnique({ where: { id: sessionId } })
    : await prisma.diagnosticSession.findFirst({
        where: { userId, subjectId: subject.id, status: 'IN_PROGRESS' },
      });

  if (!diagSession || diagSession.userId !== userId) {
    redirect(`/learn/${subjectSlug}`);
  }

  // Mark as completed if not already
  if (diagSession.status === 'IN_PROGRESS') {
    await prisma.diagnosticSession.update({
      where: { id: diagSession.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    // Write initial SkillMastery rows from estimates
    const payload = diagSession.payload as {
      estimates: Record<string, { skillCode: string; strand: string; correct: number; total: number; masteryEstimate: number }>;
      strandCounts: Record<string, number>;
    };
    const now = new Date();

    for (const [skillCode, est] of Object.entries(payload.estimates ?? {})) {
      const skill = await prisma.skill.findUnique({
        where: { subjectId_code: { subjectId: subject.id, code: skillCode } },
      });
      if (!skill) continue;

      const mastery = est.masteryEstimate;
      const nextReviewAt = scheduleNextReview(mastery, 0, now);

      await prisma.skillMastery.upsert({
        where: { userId_skillId: { userId, skillId: skill.id } },
        update: { mastery, nextReviewAt, lastPracticedAt: now },
        create: {
          userId,
          skillId: skill.id,
          mastery,
          confirmedCount: 0,
          nextReviewAt,
          lastPracticedAt: now,
        },
      });
    }

    await emitEvent({
      name: 'diagnostic_completed',
      actorUserId: userId,
      studentUserId: userId,
      subjectId: subject.id,
      payload: {
        sessionId: diagSession.id,
        subjectSlug,
        itemsSeen: diagSession.itemsSeen,
      },
    });
  }

  return (
    <main className="anx-shell flex items-center justify-center">
      <div className="anx-panel w-full max-w-lg space-y-6 p-8 sm:p-10 text-center">
        <div>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--anx-success-soft)' }}>
            <span className="text-2xl" style={{ color: 'var(--anx-success)' }}>{'\u2713'}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--anx-text)' }}>You&apos;re ready to begin</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--anx-text-muted)' }}>
            You answered {diagSession.itemsSeen} question{diagSession.itemsSeen !== 1 ? 's' : ''}. We now know where to start and will choose the next skill for you.
          </p>
        </div>
        <div className="rounded-xl border px-4 py-4 text-sm" style={{ borderColor: 'var(--anx-border-subtle)', background: 'var(--anx-primary-soft)', color: 'var(--anx-primary)' }}>
          Your first learning steps are ready. You do not need to choose the next skill yourself.
        </div>
        <Link
          href={`/learn/${subjectSlug}`}
          className="anx-btn-primary block w-full py-3.5 text-center text-base"
        >
          Go to your next skill
        </Link>
      </div>
    </main>
  );
}
