import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect, notFound } from 'next/navigation';
import { prisma } from '@/db/prisma';
import Link from 'next/link';

interface Props {
  params: Promise<{ subjectSlug: string }>;
}

export default async function DiagnosticIntroPage({ params }: Props) {
  const { subjectSlug } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const userId = (session.user as { id: string }).id;

  const subject = await prisma.subject.findUnique({ where: { slug: subjectSlug } });
  if (!subject) notFound();

  // Find or create an IN_PROGRESS session
  const existing = await prisma.diagnosticSession.findFirst({
    where: { userId, subjectId: subject.id, status: 'IN_PROGRESS' },
  });

  const sessionData = existing ?? null;

  return (
    <main className="anx-shell flex items-center justify-center">
      <div className="anx-panel w-full max-w-lg space-y-6 p-8 sm:p-10">
        <div>
          <span className="anx-badge anx-badge-blue mb-3">{subject.title}</span>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--anx-text)' }}>Find your starting point</h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--anx-text-muted)' }}>
            This short quiz helps us choose the right place for you to begin. Just try each question and do your best.
          </p>
        </div>
        <ul className="space-y-2 text-sm" style={{ color: 'var(--anx-text-secondary)' }}>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--anx-primary)' }} />
            Usually between 12 and 25 questions
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--anx-primary)' }} />
            Covers place value, addition, multiplication, factors and fractions/decimals/percentages
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--anx-primary)' }} />
            If we have enough information, it may finish early
          </li>
        </ul>
        {sessionData && (
          <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: '#fbbf24', background: 'var(--anx-warning-soft)', color: '#92400e' }}>
            You have an in-progress diagnostic ({sessionData.itemsSeen} questions answered).
          </div>
        )}
        <div className="anx-divider" />
        <div className="flex gap-3">
          <Link
            href={`/diagnostic/${subjectSlug}/run`}
            className="anx-btn-primary flex-1 py-3.5 text-center text-base"
          >
            {sessionData ? 'Resume quiz' : 'Start quiz'}
          </Link>
          <Link
            href="/dashboard"
            className="anx-btn-secondary px-5 py-3.5 text-center"
          >
            Back
          </Link>
        </div>
      </div>
    </main>
  );
}
