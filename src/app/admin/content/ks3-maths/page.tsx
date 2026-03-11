import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import { prisma } from '@/db/prisma';
import { getItemContractIssues } from '@/features/content/questionContract';
import { QuestionQaWorkbench } from '@/components/admin/QuestionQaWorkbench';

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
    },
    orderBy: { question: 'asc' },
  });

  const qaItems = importedItems.map((item) => ({
    id: item.id,
    question: item.question,
    type: item.type,
    answer: item.answer,
    options: item.options,
    skills: item.skills.map((entry) => entry.skill.code),
    issues: getItemContractIssues(item),
  }));

  const skillSet = Array.from(new Set(qaItems.flatMap((item) => item.skills))).sort();
  const issueCount = qaItems.reduce((sum, item) => sum + item.issues.length, 0);
  const flaggedCount = qaItems.filter((item) => item.issues.length > 0).length;

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

        <section className="grid gap-4 md:grid-cols-4">
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
        </section>

        <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
          <p className="font-semibold">Future encoding rules now have to satisfy the same contract checks shown here.</p>
          <p className="mt-1">
            Use this page to test whether the student-facing input mode matches the question, whether the correct answer can actually be entered, and whether grading matches the stored accepted answers.
          </p>
        </section>

        <QuestionQaWorkbench items={qaItems} availableSkills={skillSet} />
      </div>
    </main>
  );
}
