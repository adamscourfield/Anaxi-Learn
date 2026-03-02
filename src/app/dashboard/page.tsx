import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import { prisma } from '@/db/prisma';
import Link from 'next/link';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const userId = (session.user as { id: string }).id;

  const subjects = await prisma.subject.findMany({
    include: {
      skills: {
        include: {
          masteries: {
            where: { userId },
          },
        },
      },
    },
  });

  const now = new Date();

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
            <p className="text-gray-500 mt-1">Welcome back, {session.user.name ?? session.user.email}</p>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Sign out
            </button>
          </form>
        </div>

        {subjects.map((subject) => {
          const dueSkills = subject.skills.filter((skill) => {
            const mastery = skill.masteries[0];
            if (!mastery) return true;
            if (!mastery.nextReviewAt) return true;
            return mastery.nextReviewAt <= now;
          });

          return (
            <section key={subject.id} className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">{subject.title}</h2>
                <Link
                  href={`/learn/${subject.slug}`}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Start Learning
                </Link>
              </div>

              {dueSkills.length > 0 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-medium text-amber-800">
                    {dueSkills.length} skill{dueSkills.length !== 1 ? 's' : ''} due for review
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {subject.skills.map((skill) => {
                  const mastery = skill.masteries[0];
                  const masteryPct = mastery ? Math.round(mastery.mastery * 100) : 0;
                  const isDue = !mastery?.nextReviewAt || mastery.nextReviewAt <= now;

                  return (
                    <div
                      key={skill.id}
                      className={`p-4 bg-white rounded-lg border ${isDue ? 'border-amber-300' : 'border-gray-200'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-800">{skill.name}</span>
                        <span className={`text-sm font-semibold ${masteryPct >= 80 ? 'text-green-600' : masteryPct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {masteryPct}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${masteryPct >= 80 ? 'bg-green-500' : masteryPct >= 50 ? 'bg-yellow-500' : 'bg-red-400'}`}
                          style={{ width: `${masteryPct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">
                          {mastery?.lastPracticedAt
                            ? `Last practiced ${new Date(mastery.lastPracticedAt).toLocaleDateString()}`
                            : 'Not started'}
                        </span>
                        {mastery?.nextReviewAt && (
                          <span className={`text-xs ${isDue ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                            {isDue ? 'Due now' : `Next: ${new Date(mastery.nextReviewAt).toLocaleDateString()}`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        {subjects.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p>No subjects available yet.</p>
          </div>
        )}
      </div>
    </main>
  );
}
