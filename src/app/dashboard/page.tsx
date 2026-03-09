import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import { prisma } from '@/db/prisma';
import Link from 'next/link';

function getMasteryStyles(masteryPct: number) {
  if (masteryPct >= 80) {
    return {
      text: 'text-emerald-700',
      bar: 'bg-emerald-500',
    };
  }

  if (masteryPct >= 50) {
    return {
      text: 'text-amber-700',
      bar: 'bg-amber-500',
    };
  }

  return {
    text: 'text-rose-700',
    bar: 'bg-rose-500',
  };
}

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
    <main className="min-h-screen bg-gray-50 py-10 sm:py-12">
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4 sm:mb-10">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">My Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600 sm:text-base">Welcome back, {session.user.name ?? session.user.email}</p>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Sign out
            </button>
          </form>
        </header>

        <div className="space-y-6 sm:space-y-8">
          {subjects.map((subject) => {
            const sortedSkills = [...subject.skills].sort((a, b) => a.sortOrder - b.sortOrder);
            const baseSkill = sortedSkills[0];

            if (!baseSkill) return null;

            const displayedSkills = [
              {
                ...baseSkill,
                name: 'Basic Number',
              },
            ];

            const dueSkills = displayedSkills.filter((skill) => {
              const mastery = skill.masteries[0];
              if (!mastery) return true;
              if (!mastery.nextReviewAt) return true;
              return mastery.nextReviewAt <= now;
            });

            return (
              <section
                key={subject.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
                aria-label={`${subject.title} learning section`}
              >
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">{subject.title}</h2>
                  <Link
                    href={`/learn/${subject.slug}`}
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    Start Learning
                  </Link>
                </div>

                {dueSkills.length > 0 && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <p className="text-sm font-medium text-amber-800">
                      {dueSkills.length} skill{dueSkills.length !== 1 ? 's' : ''} due for review
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {displayedSkills.map((skill) => {
                    const mastery = skill.masteries[0];
                    const masteryPct = mastery ? Math.round(mastery.mastery * 100) : 0;
                    const isDue = !mastery?.nextReviewAt || mastery.nextReviewAt <= now;
                    const masteryStyles = getMasteryStyles(masteryPct);

                    return (
                      <article
                        key={skill.id}
                        className={`rounded-xl border bg-gray-50/50 p-4 transition-colors ${isDue ? 'border-amber-300' : 'border-gray-200'}`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="font-medium text-gray-900">{skill.name}</span>
                          <span className={`text-sm font-semibold tabular-nums ${masteryStyles.text}`}>{masteryPct}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                          <div className={`h-full rounded-full transition-all ${masteryStyles.bar}`} style={{ width: `${masteryPct}%` }} />
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                          <span className="text-gray-500">
                            {mastery?.lastPracticedAt
                              ? `Last practiced ${new Date(mastery.lastPracticedAt).toLocaleDateString()}`
                              : 'Not started'}
                          </span>
                          {mastery?.nextReviewAt && (
                            <span className={isDue ? 'font-medium text-amber-700' : 'text-gray-500'}>
                              {isDue ? 'Due now' : `Next: ${new Date(mastery.nextReviewAt).toLocaleDateString()}`}
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {subjects.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center text-gray-500 shadow-sm">
            <p className="text-base font-medium text-gray-700">No subjects available yet.</p>
            <p className="mt-1 text-sm text-gray-500">Check back soon to start your first learning session.</p>
          </div>
        )}

        {(['TEACHER', 'ADMIN'] as const).includes((session.user as { role?: 'STUDENT' | 'TEACHER' | 'ADMIN' }).role ?? 'STUDENT') && (
          <section className="mt-8 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 sm:p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-indigo-800">Teaching Tools</h2>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/teacher/dashboard"
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                Teacher Dashboard
              </Link>
            </div>
          </section>
        )}

        {(session.user as { role?: string }).role === 'ADMIN' && (
          <section className="mt-8 rounded-2xl border border-purple-200 bg-purple-50 p-5 sm:p-6">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-purple-800">Admin Tools</h2>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/admin/insight/${process.env.NEXT_PUBLIC_DEFAULT_SUBJECT_SLUG ?? 'ks3-maths'}`}
                className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
              >
                Insight Dashboard
              </Link>
              <Link
                href="/admin/interventions"
                className="inline-flex items-center justify-center rounded-lg border border-purple-300 bg-white px-4 py-2.5 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
              >
                Interventions
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
