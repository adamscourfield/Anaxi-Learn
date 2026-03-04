import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import { prisma } from '@/db/prisma';

const TARGET_SKILLS = ['N1.3', 'N1.5', 'N1.10', 'N1.12'];

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
      question: { startsWith: '[Slide' },
    },
    include: {
      skills: {
        include: {
          skill: { select: { code: true, name: true, strand: true } },
        },
      },
    },
    orderBy: { question: 'asc' },
  });

  const countsBySkill = TARGET_SKILLS.map((skillCode) => {
    const count = importedItems.filter((item) => item.skills.some((s) => s.skill.code === skillCode)).length;
    return { skillCode, count };
  });

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Content Verification — KS3 Maths</h1>
          <a href="/admin/insight/ks3-maths" className="text-sm text-blue-600 hover:underline">
            ← Back to Insight Dashboard
          </a>
        </div>

        <section className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Unit 1 Part A Foundation — Imported Questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="text-xs text-gray-500">Imported Items</div>
              <div className="text-2xl font-bold text-gray-900">{importedItems.length}</div>
            </div>
            {countsBySkill.map((entry) => (
              <div key={entry.skillCode} className="rounded-lg border border-gray-200 p-3">
                <div className="text-xs text-gray-500">{entry.skillCode}</div>
                <div className="text-2xl font-bold text-gray-900">{entry.count}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Question</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Answer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Mapped Skills</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {importedItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-3 text-gray-700">{item.question}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.answer}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {item.skills.map((s) => (
                        <span key={s.skillId} className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-700">
                          {s.skill.code}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {importedItems.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                    No imported Slide-tagged items found yet. Run db:import:unit1-first25 or db:import:unit1-next25 first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
