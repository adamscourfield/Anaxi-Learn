import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import { prisma } from '@/db/prisma';
import Link from 'next/link';
import { hasCompletedOnboardingDiagnostic } from '@/features/learn/onboarding';
import { selectNextSkill } from '@/features/learn/nextSkill';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const userId = (session.user as { id: string }).id;
  const role = (session.user as { role?: string }).role;

  if (role === 'TEACHER') {
    return (
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
              <p className="text-gray-500 mt-1">{session.user.name ?? session.user.email}</p>
            </div>
            <form action="/api/auth/signout" method="POST">
              <button type="submit" className="text-sm text-gray-500 hover:text-gray-700 underline">
                Sign out
              </button>
            </form>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-gray-700">
            Teacher accounts can sign in successfully. Student learning routes are hidden for this role.
          </div>
        </div>
      </main>
    );
  }

  const subjects = await prisma.subject.findMany({
    include: {
      skills: {
        include: {
          prerequisites: true,
          masteries: {
            where: { userId },
          },
        },
      },
    },
  });

  const now = new Date();
  const onboardingBySubject = new Map<string, boolean>();

  for (const subject of subjects) {
    onboardingBySubject.set(subject.id, await hasCompletedOnboardingDiagnostic(userId, subject.id));
  }

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
          const nextSkill = selectNextSkill(
            subject.skills,
            subject.skills
              .map((skill) => {
                const mastery = skill.masteries[0];
                if (!mastery) return null;
                return {
                  skillId: skill.id,
                  mastery: mastery.mastery,
                  confirmedCount: mastery.confirmedCount,
                  nextReviewAt: mastery.nextReviewAt,
                };
              })
              .filter((mastery): mastery is {
                skillId: string;
                mastery: number;
                confirmedCount: number;
                nextReviewAt: Date | null;
              } => mastery !== null),
            now
          );
          const nextSkillMastery = nextSkill ? nextSkill.masteries[0] : null;
          const nextSkillStarted = Boolean(nextSkillMastery?.lastPracticedAt);
          const nextSkillIsDue = !nextSkillMastery?.nextReviewAt || nextSkillMastery.nextReviewAt <= now;

          return (
            <section key={subject.id} className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">{subject.title}</h2>
                  {onboardingBySubject.get(subject.id) && (
                    <p className="mt-1 text-sm text-gray-500">We will pick your next small step for you.</p>
                  )}
                </div>
                {onboardingBySubject.get(subject.id) ? (
                  <Link
                    href={`/learn/${subject.slug}`}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Start next skill
                  </Link>
                ) : (
                  <Link
                    href={`/diagnostic/${subject.slug}`}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Start Onboarding
                  </Link>
                )}
              </div>

              {!onboardingBySubject.get(subject.id) ? (
                <div className="rounded-xl border border-blue-200 bg-white p-6">
                  <h3 className="text-lg font-semibold text-gray-900">Complete your onboarding quiz first</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    This first quiz builds your starting level so we can choose the right work for you.
                  </p>
                  <Link
                    href={`/diagnostic/${subject.slug}`}
                    className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Start onboarding quiz
                  </Link>
                </div>
              ) : (
                <>
                  {nextSkill && (
                    <div className="mb-4 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Your next skill</p>
                      <div className="mt-2 flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{nextSkill.name}</h3>
                          <p className="mt-1 text-sm text-gray-600">
                            {nextSkillStarted
                              ? nextSkillIsDue
                                ? 'This one is ready now, so we will bring it back in a short practice set.'
                                : 'This is the next skill we will bring back for another short, manageable practice set.'
                              : 'This is the next new skill we will introduce, one small step at a time.'}
                          </p>
                        </div>
                        <Link
                          href={`/learn/${subject.slug}`}
                          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                          {nextSkillStarted ? 'Continue skill' : 'Start skill'}
                        </Link>
                      </div>
                      <div className="mt-3 rounded-lg bg-white/80 px-3 py-3 text-sm text-gray-700 ring-1 ring-blue-100">
                        <p className="font-medium text-gray-900">What happens next</p>
                        <p className="mt-1">
                          You will answer a short set of questions. Then we will decide whether to keep practising this skill,
                          bring it back again later, or move you on when you are ready.
                        </p>
                      </div>
                    </div>
                  )}

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
                </>
              )}
            </section>
          );
        })}

        {subjects.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p>No subjects available yet.</p>
          </div>
        )}

        {role === 'ADMIN' && (
          <section className="mt-6 p-4 bg-purple-50 border border-purple-200 rounded-xl">
            <h2 className="text-sm font-semibold text-purple-800 mb-3">Admin Tools</h2>
            <div className="flex gap-3">
              <Link
                href="/admin/insight/ks3-maths"
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Insight Dashboard
              </Link>
              <Link
                href="/admin/interventions"
                className="px-4 py-2 text-sm bg-white text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors"
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
