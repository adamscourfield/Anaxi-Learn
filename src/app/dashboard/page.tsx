import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import { prisma } from '@/db/prisma';
import Link from 'next/link';
import { LearningPageShell } from '@/components/LearningPageShell';

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

function getUnitCode(skillCode: string): string {
  const m = skillCode.match(/^([A-Z]\d+)\./i);
  return m ? m[1].toUpperCase() : 'OTHER';
}

function getUnitSortKey(unitCode: string): number {
  const m = unitCode.match(/^[A-Z](\d+)$/i);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

function getStrandSortKey(strand: string): number {
  if (/^PV$/i.test(strand)) return 1;
  if (/^ADD$/i.test(strand)) return 2;
  if (/^MUL$/i.test(strand)) return 3;
  if (/^POW$/i.test(strand)) return 4;
  if (/^FAC$/i.test(strand)) return 5;
  if (/^PER$/i.test(strand)) return 6;
  if (/^ARE$/i.test(strand)) return 7;
  if (/^REP$/i.test(strand)) return 8;
  if (/^ORD$/i.test(strand)) return 9;
  if (/^LAW$/i.test(strand)) return 10;
  if (/^STA$/i.test(strand)) return 11;
  return 99;
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
    <LearningPageShell
      title="My Dashboard"
      subtitle={<>Welcome back, {session.user.name ?? session.user.email}</>}
      actions={
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 underline decoration-gray-300 underline-offset-4 transition-colors hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Sign out
          </button>
        </form>
      }
      maxWidthClassName="max-w-4xl"
    >
      <div className="space-y-6 sm:space-y-8">
          {subjects.map((subject) => {
            const sortedSkills = [...subject.skills].sort((a, b) => a.sortOrder - b.sortOrder);
            const baseSkill = sortedSkills[0];

            if (!baseSkill) return null;

            const subtopicSkills = sortedSkills;

            const dueSkills = subtopicSkills.filter((skill) => {
              const mastery = skill.masteries[0];
              if (!mastery) return true;
              if (!mastery.nextReviewAt) return true;
              return mastery.nextReviewAt <= now;
            });

            const aggregateMastery =
              subtopicSkills.length > 0
                ? Math.round(
                    (subtopicSkills.reduce((sum, skill) => {
                      const mastery = skill.masteries[0];
                      return sum + (mastery ? mastery.mastery * 100 : 0);
                    }, 0) /
                      subtopicSkills.length)
                  )
                : 0;
            const aggregateStyles = getMasteryStyles(aggregateMastery);

            const unitGroups = Object.entries(
              subtopicSkills.reduce(
                (acc, skill) => {
                  const unit = getUnitCode(skill.code);
                  acc[unit] = acc[unit] ?? [];
                  acc[unit].push(skill);
                  return acc;
                },
                {} as Record<string, typeof subtopicSkills>
              )
            ).sort(([a], [b]) => getUnitSortKey(a) - getUnitSortKey(b));

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
                  <article className={`rounded-xl border bg-gray-50/50 p-4 transition-colors ${dueSkills.length > 0 ? 'border-amber-300' : 'border-gray-200'}`}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="font-medium text-gray-900">Basic Number</span>
                      <span className={`text-sm font-semibold tabular-nums ${aggregateStyles.text}`}>{aggregateMastery}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div className={`h-full rounded-full transition-all ${aggregateStyles.bar}`} style={{ width: `${aggregateMastery}%` }} />
                    </div>
                    <div className="mt-2 text-xs text-gray-500">{subtopicSkills.length} subtopic{subtopicSkills.length === 1 ? '' : 's'} • grouped by unit</div>
                  </article>

                  <div className="space-y-2">
                    {unitGroups.map(([unitCode, skillsInUnit]) => {
                      const unitDue = skillsInUnit.filter((skill) => {
                        const mastery = skill.masteries[0];
                        return !mastery?.nextReviewAt || mastery.nextReviewAt <= now;
                      }).length;

                      const unitMastery =
                        skillsInUnit.length > 0
                          ? Math.round(
                              skillsInUnit.reduce((sum, skill) => {
                                const mastery = skill.masteries[0];
                                return sum + (mastery ? mastery.mastery * 100 : 0);
                              }, 0) / skillsInUnit.length
                            )
                          : 0;

                      const unitStyles = getMasteryStyles(unitMastery);

                      const strandGroups = Object.entries(
                        skillsInUnit.reduce(
                          (acc, skill) => {
                            const strand = (skill.strand || 'OTHER').toUpperCase();
                            acc[strand] = acc[strand] ?? [];
                            acc[strand].push(skill);
                            return acc;
                          },
                          {} as Record<string, typeof skillsInUnit>
                        )
                      ).sort(([a], [b]) => getStrandSortKey(a) - getStrandSortKey(b));

                      return (
                        <details key={unitCode} className="group rounded-lg border border-gray-200 bg-white open:border-blue-200" open={unitDue > 0}>
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="inline-block text-xs transition-transform group-open:rotate-90">▶</span>
                              <span className="text-sm font-semibold text-gray-900">{unitCode}</span>
                              <span className="text-xs text-gray-500">{skillsInUnit.length} subtopics</span>
                            </div>
                            <div className="flex items-center gap-3">
                              {unitDue > 0 && <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">{unitDue} due</span>}
                              <span className={`text-xs font-semibold tabular-nums ${unitStyles.text}`}>{unitMastery}%</span>
                            </div>
                          </summary>

                          <div className="border-t border-gray-100 px-3 py-3 space-y-3">
                            {strandGroups.map(([strand, skillsInStrand]) => {
                              const strandDue = skillsInStrand.filter((skill) => {
                                const mastery = skill.masteries[0];
                                return !mastery?.nextReviewAt || mastery.nextReviewAt <= now;
                              }).length;

                              const strandMastery =
                                skillsInStrand.length > 0
                                  ? Math.round(
                                      skillsInStrand.reduce((sum, skill) => {
                                        const mastery = skill.masteries[0];
                                        return sum + (mastery ? mastery.mastery * 100 : 0);
                                      }, 0) / skillsInStrand.length
                                    )
                                  : 0;

                              const strandStyles = getMasteryStyles(strandMastery);

                              return (
                                <section key={`${unitCode}-${strand}`} className="rounded-md border border-gray-100 bg-gray-50/40 p-2.5">
                                  <div className="mb-2 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{strand}</span>
                                      <span className="text-xs text-gray-500">{skillsInStrand.length} subtopics</span>
                                      {strandDue > 0 && <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">{strandDue} due</span>}
                                    </div>
                                    <span className={`text-xs font-semibold tabular-nums ${strandStyles.text}`}>{strandMastery}%</span>
                                  </div>

                                  <div className="space-y-2 pl-3 sm:pl-4 border-l-2 border-gray-100">
                                    {skillsInStrand.map((skill) => {
                                      const mastery = skill.masteries[0];
                                      const masteryPct = mastery ? Math.round(mastery.mastery * 100) : 0;
                                      const isDue = !mastery?.nextReviewAt || mastery.nextReviewAt <= now;
                                      const masteryStyles = getMasteryStyles(masteryPct);

                                      return (
                                        <article
                                          key={skill.id}
                                          className={`rounded-lg border bg-white p-3 transition-colors ${isDue ? 'border-amber-300' : 'border-gray-200'}`}
                                        >
                                          <div className="mb-2 flex items-center justify-between gap-3">
                                            <span className="text-sm font-medium text-gray-900">{skill.code} · {skill.name}</span>
                                            <span className={`text-xs font-semibold tabular-nums ${masteryStyles.text}`}>{masteryPct}%</span>
                                          </div>
                                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                                            <div className={`h-full rounded-full transition-all ${masteryStyles.bar}`} style={{ width: `${masteryPct}%` }} />
                                          </div>
                                        </article>
                                      );
                                    })}
                                  </div>
                                </section>
                              );
                            })}
                          </div>
                        </details>
                      );
                    })}
                  </div>
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

        {(() => {
          const role = (session.user as { role?: 'STUDENT' | 'TEACHER' | 'ADMIN' }).role;
          return role === 'TEACHER' || role === 'ADMIN';
        })() && (
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
    </LearningPageShell>
  );
}
