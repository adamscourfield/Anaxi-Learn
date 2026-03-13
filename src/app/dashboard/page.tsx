import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import { prisma } from '@/db/prisma';
import Link from 'next/link';
import { hasCompletedOnboardingDiagnostic } from '@/features/learn/onboarding';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const userId = (session.user as { id: string }).id;
  const role = (session.user as { role?: string }).role;

  if (role === 'TEACHER') {
    return (
      <main className="anx-shell">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--anx-text)' }}>Teacher Dashboard</h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--anx-text-muted)' }}>{session.user.name ?? session.user.email}</p>
            </div>
            <form action="/api/auth/signout" method="POST">
              <button type="submit" className="anx-btn-ghost text-sm">
                Sign out
              </button>
            </form>
          </div>
          <div className="anx-card p-6" style={{ color: 'var(--anx-text-secondary)' }}>
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
    <main className="anx-shell">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--anx-text)' }}>My Dashboard</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--anx-text-muted)' }}>
              Welcome back, {session.user.name ?? session.user.email}
            </p>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="anx-btn-ghost text-sm">
              Sign out
            </button>
          </form>
        </header>

        {subjects.map((subject) => {
          const dueSkills = subject.skills.filter((skill) => {
            const mastery = skill.masteries[0];
            if (!mastery) return true;
            if (!mastery.nextReviewAt) return true;
            return mastery.nextReviewAt <= now;
          });

          return (
            <section key={subject.id} className="mb-10">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--anx-text)' }}>{subject.title}</h2>
                  {onboardingBySubject.get(subject.id) && (
                    <p className="mt-1 text-sm" style={{ color: 'var(--anx-text-muted)' }}>We will pick the best next skill for you.</p>
                  )}
                </div>
                {onboardingBySubject.get(subject.id) ? (
                  <Link
                    href={`/learn/${subject.slug}`}
                    className="anx-btn-primary px-5 py-2.5 text-sm"
                  >
                    Start next skill
                  </Link>
                ) : (
                  <Link
                    href={`/diagnostic/${subject.slug}`}
                    className="anx-btn-primary px-5 py-2.5 text-sm"
                  >
                    Start Onboarding
                  </Link>
                )}
              </div>

              {!onboardingBySubject.get(subject.id) ? (
                <div className="anx-panel p-6 space-y-4">
                  <h3 className="text-base font-semibold" style={{ color: 'var(--anx-text)' }}>Complete your onboarding quiz first</h3>
                  <p className="text-sm" style={{ color: 'var(--anx-text-muted)' }}>
                    This first quiz builds your starting level so we can choose the right work for you.
                  </p>
                  <Link
                    href={`/diagnostic/${subject.slug}`}
                    className="anx-btn-primary text-sm"
                  >
                    Start onboarding quiz
                  </Link>
                </div>
              ) : (
                <>
                  {dueSkills.length > 0 && (
                    <div className="mb-4 anx-alert anx-alert-warning">
                      <p className="text-sm font-medium">
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
                          className="anx-card p-4"
                          style={isDue ? { borderColor: 'var(--anx-warning)' } : undefined}
                        >
                          <div className="flex items-center justify-between mb-2.5">
                            <span className="text-sm font-semibold" style={{ color: 'var(--anx-text)' }}>{skill.name}</span>
                            <span className={`anx-badge ${masteryPct >= 80 ? 'anx-badge-green' : masteryPct >= 50 ? 'anx-badge-amber' : 'anx-badge-red'}`}>
                              {masteryPct}%
                            </span>
                          </div>
                          <div className="anx-mastery-track">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${masteryPct}%`,
                                background: masteryPct >= 80 ? 'var(--anx-success)' : masteryPct >= 50 ? 'var(--anx-warning)' : 'var(--anx-danger)',
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-2.5">
                            <span className="text-xs" style={{ color: 'var(--anx-text-faint)' }}>
                              {mastery?.lastPracticedAt
                                ? `Last practiced ${new Date(mastery.lastPracticedAt).toLocaleDateString()}`
                                : 'Not started'}
                            </span>
                            {mastery?.nextReviewAt && (
                              <span className="text-xs font-medium" style={{ color: isDue ? '#b45309' : 'var(--anx-text-faint)' }}>
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
          <div className="anx-card py-16 text-center" style={{ color: 'var(--anx-text-faint)' }}>
            <p>No subjects available yet.</p>
          </div>
        )}

        {role === 'ADMIN' && (
          <section className="mt-8 rounded-xl border p-5" style={{ borderColor: '#c4b5fd', background: 'rgba(139, 92, 246, 0.06)' }}>
            <p className="anx-section-label mb-3" style={{ color: '#6d28d9' }}>Admin Tools</p>
            <div className="flex gap-3">
              <Link
                href="/admin/insight/ks3-maths"
                className="anx-btn-primary text-sm"
                style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)' }}
              >
                Insight Dashboard
              </Link>
              <Link
                href="/admin/interventions"
                className="anx-btn-secondary text-sm"
                style={{ borderColor: '#c4b5fd', color: '#6d28d9' }}
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
