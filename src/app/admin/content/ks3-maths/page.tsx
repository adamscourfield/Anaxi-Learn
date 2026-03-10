import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import { prisma } from '@/db/prisma';
import { QuestionQaWorkbench } from '@/components/admin/QuestionQaWorkbench';
import { buildQaItemView } from '@/features/items/questionQa.server';

export default async function AdminContentKSMathsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const role = (session.user as { role: string }).role;
  if (role !== 'ADMIN') redirect('/dashboard');

  const subject = await prisma.subject.findUnique({ where: { slug: 'ks3-maths' } });
  if (!subject) return <div>Subject not found</div>;

  const importedItems = await prisma.item.findMany({
    where: {
      subjectId: subject.id,
    },
    include: {
      skills: {
        include: {
          skill: { select: { code: true } },
        },
      },
      reviewNotes: {
        include: {
          author: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { question: 'asc' },
  });

  const qaItems = importedItems.map(buildQaItemView);
  const skillSet = Array.from(new Set(qaItems.flatMap((item) => item.skills))).sort();
  const issueCount = qaItems.reduce((sum, item) => sum + item.issues.length, 0);
  const flaggedCount = qaItems.filter((item) => item.issues.length > 0).length;
  const repairOpenCount = qaItems.reduce(
    (sum, item) => sum + item.reviewNotes.filter((note) => note.status === 'OPEN').length,
    0
  );

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Question QA Lab</h1>
            <p className="mt-1 text-sm text-gray-500">
              Review answer mode, stored answers, accepted answers, and grading behaviour before students see items.
            </p>
          </div>
          <a href="/admin/insight/ks3-maths" className="text-sm text-blue-600 hover:underline">
            ← Back to Insight Dashboard
          </a>
        </div>

        <section className="grid gap-4 md:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Questions loaded</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{qaItems.length}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Flagged items</div>
            <div className="mt-1 text-2xl font-bold text-red-600">{flaggedCount}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Contract issues</div>
            <div className="mt-1 text-2xl font-bold text-amber-600">{issueCount}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Skills covered</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{skillSet.length}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Open repair notes</div>
            <div className="mt-1 text-2xl font-bold text-indigo-600">{repairOpenCount}</div>
          </div>
        </section>

        <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
          <p className="font-semibold">Use this page to test how the student actually answers the question.</p>
          <p className="mt-1">
            Filter by answer mode, preview the student input, and check whether the stored answer can really be selected or typed.
          </p>
        </section>

        <QuestionQaWorkbench items={qaItems} availableSkills={skillSet} />
      </div>
    </main>
  );
}
