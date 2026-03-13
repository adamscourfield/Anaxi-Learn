import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import { prisma } from '@/db/prisma';
import Link from 'next/link';
import { hasCompletedOnboardingDiagnostic } from '@/features/learn/onboarding';
import { selectNextSkill } from '@/features/learn/nextSkill';
import { LearningPageShell } from '@/components/LearningPageShell';

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
  }).format(value);
}

function progressTone(masteryPct: number) {
  if (masteryPct >= 80) {
    return {
      text: 'text-emerald-700',
      chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
      bar: 'bg-emerald-500',
    };
  }

  if (masteryPct >= 50) {
    return {
      text: 'text-amber-700',
      chip: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
      bar: 'bg-amber-500',
    };
  }

  return {
    text: 'text-rose-700',
    chip: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
    bar: 'bg-rose-400',
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const userId = (session.user as { id: string }).id;
  const role = (session.user as { role?: string }).role;

  if (role === 'TEACHER') {
    return (
      <LearningPageShell
        title="Teacher Dashboard"
        subtitle={session.user.name ?? session.user.email ?? 'Teacher account'}
        maxWidthClassName="max-w-3xl"
        actions={
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="anx-btn-secondary px-3 py-2 text-xs sm:text-sm">
              Sign out
            </button>
          </form>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span className="anx-chip">Teacher view</span>
            <span className="anx-chip">Student routes hidden</span>
          </div>
        }
      >
        <div className="anx-card p-6 text-sm text-slate-700">
          Teacher accounts can sign in successfully. Student learning routes are hidden for this role.
        </div>
      </LearningPageShell>
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

  const subjectCards = subjects.map((subject) => {
    const onboardingComplete = onboardingBySubject.get(subject.id) ?? false;
    const dueSkills = subject.skills.filter((skill) => {
      const mastery = skill.masteries[0];
      if (!mastery) return true;
      if (!mastery.nextReviewAt) return true;
      return mastery.nextReviewAt <= now;
    });

    const startedSkills = subject.skills.filter((skill) => Boolean(skill.masteries[0]?.lastPracticedAt)).length;
    const completedEnoughSkills = subject.skills.filter((skill) => (skill.masteries[0]?.mastery ?? 0) >= 0.8).length;
    const averageMastery = subject.skills.length
      ? Math.round(
          (subject.skills.reduce((sum, skill) => sum + (skill.masteries[0]?.mastery ?? 0), 0) / subject.skills.length) * 100
        )
      : 0;

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
        .filter(
          (
            mastery
          ): mastery is {
            skillId: string;
            mastery: number;
            confirmedCount: number;
            nextReviewAt: Date | null;
          } => mastery !== null
        ),
      now
    );

    const nextSkillMastery = nextSkill ? nextSkill.masteries[0] : null;
    const nextSkillStarted = Boolean(nextSkillMastery?.lastPracticedAt);
    const nextSkillIsDue = !nextSkillMastery?.nextReviewAt || nextSkillMastery.nextReviewAt <= now;
    const dueNowCount = dueSkills.length;

    return {
      subject,
      onboardingComplete,
      startedSkills,
      completedEnoughSkills,
      averageMastery,
      nextSkill,
      nextSkillStarted,
      nextSkillIsDue,
      dueNowCount,
    };
  });

  return (
    <LearningPageShell
      title="My Dashboard"
      subtitle={`Welcome back, ${session.user.name ?? session.user.email}`}
      maxWidthClassName="max-w-5xl"
      actions={
        <form action="/api/auth/signout" method="POST">
          <button type="submit" className="anx-btn-secondary px-3 py-2 text-xs sm:text-sm">
            Sign out
          </button>
        </form>
      }
      meta={
        <div className="flex flex-wrap items-center gap-2">
          <span className="anx-chip">{subjects.length} subject{subjects.length !== 1 ? 's' : ''}</span>
          <span className="anx-chip">One step at a time</span>
          <span className="anx-chip">Due work first</span>
        </div>
      }
    >
      {subjectCards.map(({ subject, onboardingComplete, startedSkills, completedEnoughSkills, averageMastery, nextSkill, nextSkillStarted, nextSkillIsDue, dueNowCount }) => (
        <section key={subject.id} className="space-y-4">
          <div className="anx-card overflow-hidden">
            <div className="border-b border-[color:var(--anx-border)] bg-[color:var(--anx-surface-soft)] px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Keep learning</p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">{subject.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {onboardingComplete
                      ? 'We will keep your next step clear and easy to follow.'
                      : 'Start with a short quiz so we can choose the right place for you.'}
                  </p>
                </div>
                {onboardingComplete ? (
                  <Link href={`/learn/${subject.slug}`} className="anx-btn-primary shrink-0">
                    {nextSkillStarted ? 'Keep going' : 'Start next skill'}
                  </Link>
                ) : (
                  <Link href={`/diagnostic/${subject.slug}`} className="anx-btn-primary shrink-0">
                    Start quiz
                  </Link>
                )}
              </div>
            </div>

            <div className="grid gap-3 px-5 py-5 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium text-slate-500">Due now</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{onboardingComplete ? dueNowCount : '—'}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {onboardingComplete
                    ? dueNowCount > 0
                      ? `${dueNowCount} skill${dueNowCount !== 1 ? 's are' : ' is'} ready now.`
                      : 'Nothing urgent — just keep going with the next step.'
                    : 'This will show after your quiz.'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium text-slate-500">Progress so far</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{onboardingComplete ? `${averageMastery}%` : 'Not started'}</p>
                <div className="mt-3 anx-progress-track">
                  <div className="anx-progress-bar" style={{ width: `${onboardingComplete ? averageMastery : 0}%` }} />
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {onboardingComplete
                    ? `${startedSkills} of ${subject.skills.length} skills started.`
                    : 'Your progress will show here once you begin.'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium text-slate-500">Next step</p>
                {onboardingComplete && nextSkill ? (
                  <>
                    <p className="mt-2 text-base font-semibold text-slate-900">{nextSkill.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {nextSkillStarted
                        ? nextSkillIsDue
                          ? 'Ready now for a short set.'
                          : 'We will come back to this soon.'
                        : 'This is the next new skill for you.'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="anx-chip">{nextSkillStarted ? 'In progress' : 'New skill'}</span>
                      <span className="anx-chip">{nextSkillIsDue ? 'Due now' : 'Up next'}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-base font-semibold text-slate-900">Start your quiz</p>
                    <p className="mt-1 text-sm text-slate-600">
                      It helps us choose the right level and your first lesson.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="anx-chip">Quiz first</span>
                      <span className="anx-chip">Short and simple</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {onboardingComplete && nextSkill && (
              <div className="border-t border-[color:var(--anx-border)] bg-slate-50/80 px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">What happens next</p>
                    <p className="mt-1 text-sm text-slate-600">
                      You will do a short set of questions. Then we will choose the best next step for you.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="anx-chip">{completedEnoughSkills} secure</span>
                    <span className="anx-chip">{subject.skills.length - completedEnoughSkills} still building</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {onboardingComplete && (
            <div className="anx-card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--anx-border)] bg-[color:var(--anx-surface-soft)] px-5 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Skill overview</h3>
                  <p className="text-xs text-slate-500">See your progress and what is ready next.</p>
                </div>
                {dueNowCount > 0 && <span className="anx-chip bg-amber-50 text-amber-700 ring-1 ring-amber-200">{dueNowCount} due now</span>}
              </div>

              <div className="space-y-3 px-5 py-4">
                {subject.skills.map((skill) => {
                  const mastery = skill.masteries[0];
                  const masteryPct = mastery ? Math.round(mastery.mastery * 100) : 0;
                  const isDue = !mastery?.nextReviewAt || mastery.nextReviewAt <= now;
                  const tone = progressTone(masteryPct);

                  return (
                    <div key={skill.id} className={`rounded-xl border p-4 ${isDue ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white'}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-slate-800">{skill.name}</span>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tone.chip}`}>
                              {masteryPct}% mastery
                            </span>
                            {isDue && <span className="anx-chip bg-amber-50 text-amber-700 ring-1 ring-amber-200">Due now</span>}
                          </div>
                          <p className="mt-2 text-sm text-slate-600">
                            {mastery?.lastPracticedAt
                              ? `Last practised ${formatDate(new Date(mastery.lastPracticedAt))}`
                              : 'Not started yet.'}
                          </p>
                        </div>
                        <div className="text-left text-xs text-slate-500 sm:text-right">
                          {mastery?.nextReviewAt ? (
                            isDue ? (
                              <span className="font-medium text-amber-700">Ready now</span>
                            ) : (
                              <span>Next review {formatDate(new Date(mastery.nextReviewAt))}</span>
                            )
                          ) : (
                            <span>{mastery?.lastPracticedAt ? 'Next review being planned' : 'Start when ready'}</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 anx-progress-track">
                        <div className={tone.bar} style={{ width: `${masteryPct}%`, height: '100%' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      ))}

      {subjects.length === 0 && (
        <div className="anx-card px-6 py-16 text-center text-slate-500">
          <p>No subjects available yet.</p>
        </div>
      )}

      {role === 'ADMIN' && (
        <section className="anx-card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-purple-600">Admin tools</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Operational dashboards</h2>
              <p className="mt-1 text-sm text-slate-600">Jump straight to insight and intervention views.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/insight/ks3-maths" className="anx-btn-primary">
                Insight dashboard
              </Link>
              <Link href="/admin/interventions" className="anx-btn-secondary">
                Interventions
              </Link>
            </div>
          </div>
        </section>
      )}
    </LearningPageShell>
  );
}
