import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import { prisma } from '@/db/prisma';
import { QuestionQaWorkbench } from '@/components/admin/QuestionQaWorkbench';
import { buildQaItemView } from '@/features/items/questionQa.server';

interface Props {
  params: Promise<{ subjectSlug: string }>;
}

export default async function AdminContentPage({ params }: Props) {
  const { subjectSlug } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const role = (session.user as { role: string }).role;
  if (role !== 'ADMIN') redirect('/dashboard');

  const subject = await prisma.subject.findUnique({ where: { slug: subjectSlug } });
  if (!subject) return <div>Subject not found</div>;

  const importedItems = await prisma.item.findMany({
    where: {
      OR: [
        { subjectId: subject.id },
        {
          skills: {
            some: {
              skill: {
                subjectId: subject.id,
              },
            },
          },
        },
      ],
    },
    include: {
      skills: {
        include: {
          skill: { select: { code: true, sortOrder: true } },
        },
      },
      reviewNotes: {
        include: {
          author: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: [{ createdAt: 'asc' }, { question: 'asc' }],
  });

  const qaItems = importedItems
    .map(buildQaItemView)
    .sort((a, b) => {
      const purposeOrder = { ONBOARDING: 0, LEARN: 1, RETEACH_SHADOW: 2 } as const;
      const routeOrder = { A: 0, B: 1, C: 2 } as const;

      return (
        a.primarySkillSortOrder - b.primarySkillSortOrder ||
        a.primarySkillCode.localeCompare(b.primarySkillCode) ||
        purposeOrder[a.questionPurpose] - purposeOrder[b.questionPurpose] ||
        a.sequenceKey.diagnosticOrdinal - b.sequenceKey.diagnosticOrdinal ||
        a.sequenceKey.questionOrdinal - b.sequenceKey.questionOrdinal ||
        a.sequenceKey.questionAlphaOrder - b.sequenceKey.questionAlphaOrder ||
        (routeOrder[a.sequenceKey.shadowRoute as keyof typeof routeOrder] ?? 99) -
          (routeOrder[b.sequenceKey.shadowRoute as keyof typeof routeOrder] ?? 99) ||
        a.sequenceKey.shadowOrdinal - b.sequenceKey.shadowOrdinal ||
        (a.sequenceKey.createdAt ?? '').localeCompare(b.sequenceKey.createdAt ?? '') ||
        a.displayQuestion.localeCompare(b.displayQuestion)
      );
    });
  const skillSet = Array.from(new Set(qaItems.flatMap((item) => item.skills))).sort();
  const typeSet = Array.from(new Set(qaItems.map((item) => item.type))).sort();
  const typeCounts = typeSet.map((type) => ({
    type,
    count: qaItems.filter((item) => item.type === type).length,
  }));
  const realQuestionCount = qaItems.filter((item) => !item.isPlaceholder).length;
  const placeholderCount = qaItems.filter((item) => item.isPlaceholder).length;
  const issueCount = qaItems.reduce((sum, item) => sum + item.issues.length, 0);
  const flaggedCount = qaItems.filter((item) => item.issues.length > 0).length;
  const repairOpenCount = qaItems.reduce(
    (sum, item) => sum + item.reviewNotes.filter((note) => note.status === 'OPEN').length,
    0
  );

  return (
    <main className="anx-shell">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--anx-text)' }}>Question QA Lab — {subject.title}</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--anx-text-muted)' }}>
              Review answer mode, stored answers, accepted answers, and grading behaviour before students see items.
            </p>
          </div>
          <a href={`/admin/insight/${subject.slug}`} className="anx-link text-sm">
            ← Back to Insight Dashboard
          </a>
        </div>

        <section className="grid gap-4 md:grid-cols-6">
          <div className="anx-stat">
            <div className="anx-stat-label">Total rows</div>
            <div className="anx-stat-value">{qaItems.length}</div>
          </div>
          <div className="anx-stat">
            <div className="anx-stat-label">Real questions</div>
            <div className="anx-stat-value" style={{ color: 'var(--anx-success)' }}>{realQuestionCount}</div>
          </div>
          <div className="anx-stat">
            <div className="anx-stat-label">Placeholder rows</div>
            <div className="anx-stat-value" style={{ color: 'var(--anx-text-muted)' }}>{placeholderCount}</div>
            {placeholderCount > 0 && (
              <div className="mt-1 text-xs" style={{ color: 'var(--anx-text-muted)' }}>Hidden by default in the list</div>
            )}
          </div>
          <div className="anx-stat">
            <div className="anx-stat-label">Flagged items</div>
            <div className="anx-stat-value" style={{ color: 'var(--anx-danger)' }}>{flaggedCount}</div>
          </div>
          <div className="anx-stat">
            <div className="anx-stat-label">Contract issues</div>
            <div className="anx-stat-value" style={{ color: '#b45309' }}>{issueCount}</div>
          </div>
          <div className="anx-stat">
            <div className="anx-stat-label">Skills covered</div>
            <div className="anx-stat-value">{skillSet.length}</div>
          </div>
          <div className="anx-stat">
            <div className="anx-stat-label">Open repair notes</div>
            <div className="anx-stat-value" style={{ color: 'var(--anx-primary)' }}>{repairOpenCount}</div>
          </div>
        </section>

        <section className="anx-alert anx-alert-info p-5 text-sm">
          <p className="font-semibold">Use this page to test how the student actually answers the question.</p>
          <p className="mt-1">
            Filter by answer mode or stored type, preview the student input, and check whether the stored answer can really be selected or typed.
          </p>
        </section>

        <section className="anx-card-flat p-5">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--anx-text)' }}>Stored Type Coverage</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {typeCounts.map(({ type, count }) => (
              <div key={type} className="anx-badge rounded-full px-3 py-2 text-sm">
                {type}: <span className="font-semibold" style={{ color: 'var(--anx-text)' }}>{count}</span>
              </div>
            ))}
          </div>
        </section>

        <QuestionQaWorkbench items={qaItems} availableSkills={skillSet} availableTypes={typeSet} />
      </div>
    </main>
  );
}
