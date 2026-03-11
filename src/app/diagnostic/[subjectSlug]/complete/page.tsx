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
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-xl border border-gray-200 p-8 space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Diagnostic Complete!</h1>
          <p className="text-gray-500 mt-2">
            We&apos;ve assessed {diagSession.itemsSeen} question{diagSession.itemsSeen !== 1 ? 's' : ''} and
            initialised your skill mastery profile.
          </p>
        </div>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          Your starting level is now ready. We&apos;ll use it to choose the right next questions for you.
        </div>
        <Link
          href={`/learn/${subjectSlug}`}
          className="block w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
        >
          Continue to learning
        </Link>
      </div>
    </main>
  );
}
