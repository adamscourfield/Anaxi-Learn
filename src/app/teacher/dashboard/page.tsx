import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/db/prisma';
import { LearningPageShell } from '@/components/LearningPageShell';

type EventPayload = Record<string, unknown>;

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return '—';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function parseDays(input: string | undefined): number {
  const n = Number(input ?? '30');
  if (![7, 30, 90].includes(n)) return 30;
  return n;
}

type TrendDirection = 'UP' | 'FLAT' | 'DOWN';

function efficiencyScore(attempts: Array<{ correct: boolean; instructionalTimeMs: number }>): number {
  if (attempts.length === 0) return 0;
  const value = attempts.reduce((sum, a) => {
    const minutes = Math.max(1 / 60, (a.instructionalTimeMs ?? 0) / 60000);
    return sum + (a.correct ? 1 : 0) / minutes;
  }, 0);
  return value / attempts.length;
}

function trendDirection(recent: number, previous: number): TrendDirection {
  const delta = recent - previous;
  if (delta > 0.03) return 'UP';
  if (delta < -0.03) return 'DOWN';
  return 'FLAT';
}

function trendBadge(direction: TrendDirection): string {
  if (direction === 'UP') return '↑ Improving';
  if (direction === 'DOWN') return '↓ Declining';
  return '→ Stable';
}

const MOMENTUM_HELP =
  'Momentum is a proxy, not a clinical metric. We compare recent vs previous equal windows using efficiency = correctness ÷ time-on-task (minutes), then bucket into Improving / Stable / Declining.';

function getRiskModel(params: { checkpointRate: number; interactionPassRate: number; interventions: number; wrongFirstDiff: number }) {
  const { checkpointRate, interactionPassRate, interventions, wrongFirstDiff } = params;
  let score = 0;
  if (interventions > 0) score += 45;
  if (checkpointRate < 0.5) score += 25;
  else if (checkpointRate < 0.7) score += 15;
  if (interactionPassRate < 0.5) score += 20;
  else if (interactionPassRate < 0.7) score += 10;
  if (wrongFirstDiff >= 3) score += 15;
  else if (wrongFirstDiff > 0) score += 8;

  const riskLevel: 'RED' | 'AMBER' | 'GREEN' = score >= 50 ? 'RED' : score >= 25 ? 'AMBER' : 'GREEN';
  return { riskScore: Math.min(100, score), riskLevel };
}

interface Props {
  searchParams?: Promise<{ days?: string; subtopic?: string }>;
}

export default async function TeacherDashboardPage({ searchParams }: Props) {
  const params = (await searchParams) ?? {};
  const days = parseDays(params.days);
  const subtopicFilter = params.subtopic?.trim() || '';

  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const user = session.user as { id: string; role?: string; name?: string | null; email?: string | null };
  if (user.role !== 'TEACHER' && user.role !== 'ADMIN') redirect('/dashboard');

  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: user.id },
    include: {
      classrooms: {
        include: {
          classroom: {
            include: {
              enrollments: {
                include: {
                  student: {
                    include: {
                      skillMasteries: {
                        select: { mastery: true, confirmedCount: true, nextReviewAt: true },
                      },
                      knowledgeSkillStates: {
                        select: {
                          latestDle: true,
                          durabilityBand: true,
                          latestInstructionalTimeMs: true,
                        },
                      },
                    },
                  },
                  studentProfile: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!teacherProfile) {
    return (
      <LearningPageShell
        title="Teacher Dashboard"
        subtitle={`Observe-linked analytics for ${user.name ?? user.email}`}
      >
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No teacher profile linked yet. Add a TeacherProfile row mapped to your Observe teacher id.
        </div>
      </LearningPageShell>
    );
  }

  const allStudentIds = [...new Set(teacherProfile.classrooms.flatMap((tc) => tc.classroom.enrollments.map((e) => e.studentUserId)))];
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const events = allStudentIds.length
    ? await prisma.event.findMany({
        where: {
          studentUserId: { in: allStudentIds },
          createdAt: { gte: since },
          name: {
            in: [
              'question_answered',
              'route_completed',
              'step_checkpoint_attempted',
              'step_interaction_evaluated',
              'intervention_flagged',
              'reward_granted',
            ],
          },
        },
        select: {
          name: true,
          studentUserId: true,
          subjectId: true,
          payload: true,
          createdAt: true,
        },
      })
    : [];

  const trendWindowStart = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);
  const questionAttempts = allStudentIds.length
    ? await prisma.questionAttempt.findMany({
        where: {
          userId: { in: allStudentIds },
          occurredAt: { gte: trendWindowStart },
        },
        select: {
          userId: true,
          correct: true,
          instructionalTimeMs: true,
          occurredAt: true,
          skill: { select: { subjectId: true } },
        },
      })
    : [];

  const subjectMap = new Map((await prisma.subject.findMany({ select: { id: true, slug: true } })).map((s) => [s.slug, s.id]));
  const now = new Date();

  return (
    <LearningPageShell
      title="Teacher Dashboard"
      subtitle={`Observe-linked analytics for ${user.name ?? user.email}`}
      maxWidthClassName="max-w-6xl"
      meta={
        <>
          <p><span className="font-semibold">Observe Teacher ID:</span> {teacherProfile.externalTeacherId}</p>
          <p><span className="font-semibold">Observe School ID:</span> {teacherProfile.externalSchoolId ?? '—'}</p>
          <p><span className="font-semibold">Time window:</span> last {days} days</p>
          <p><span className="font-semibold">Subtopic filter:</span> {subtopicFilter || 'All'}</p>
          <p className="mt-2 rounded-lg border px-3 py-1.5 text-xs" style={{ borderColor: 'var(--anx-border)', background: 'var(--anx-primary-soft)', color: 'var(--anx-primary)' }}>
            <span className="font-semibold">DLE momentum note:</span> {MOMENTUM_HELP}
          </p>
        </>
      }
    >
      <div className="flex flex-wrap gap-2 text-xs">
          {[7, 30, 90].map((d) => (
            <Link
              key={d}
              href={`/teacher/dashboard?days=${d}${subtopicFilter ? `&subtopic=${encodeURIComponent(subtopicFilter)}` : ''}`}
              className={`rounded-xl border px-3.5 py-1.5 font-medium transition-all ${days === d ? 'border-[var(--anx-primary)] bg-[var(--anx-primary-soft)] text-[var(--anx-primary)]' : 'border-[var(--anx-border)] bg-white text-[var(--anx-text-secondary)]'}`}
            >
              {d}d
            </Link>
          ))}
        </div>

        <div className="mt-6 space-y-6">
          {teacherProfile.classrooms.map((tc) => {
            const cls = tc.classroom;
            const classSubjectId = cls.subjectSlug ? subjectMap.get(cls.subjectSlug) : undefined;
            const classStudents = cls.enrollments.map((e) => e.student);
            const classStudentIds = new Set(classStudents.map((s) => s.id));

            const classEvents = events.filter((e) => {
              if (!e.studentUserId || !classStudentIds.has(e.studentUserId)) return false;
              if (classSubjectId && !(e.subjectId === classSubjectId || e.subjectId == null)) return false;
              if (subtopicFilter && (e.payload as EventPayload).subtopicCode !== subtopicFilter) return false;
              return true;
            });

            const questionEvents = classEvents.filter((e) => e.name === 'question_answered');
            const routeEvents = classEvents.filter((e) => e.name === 'route_completed');
            const stepAttemptEvents = classEvents.filter((e) => e.name === 'step_checkpoint_attempted');
            const interactionEvalEvents = classEvents.filter((e) => e.name === 'step_interaction_evaluated');
            const interventionEvents = classEvents.filter((e) => e.name === 'intervention_flagged');

            const avgMasteryVals = classStudents.flatMap((s) => s.skillMasteries.map((m) => m.mastery));
            const avgMastery = avgMasteryVals.length ? Math.round((avgMasteryVals.reduce((a, b) => a + b, 0) / avgMasteryVals.length) * 100) : 0;
            const stableCount = classStudents.filter((s) => s.skillMasteries.some((m) => m.confirmedCount >= 2 && m.mastery >= 0.85)).length;
            const reviewDueCount = classStudents.filter((s) => s.skillMasteries.some((m) => !m.nextReviewAt || m.nextReviewAt <= now)).length;

            const checkpointCorrect = stepAttemptEvents.filter((e) => Boolean((e.payload as EventPayload).correct)).length;
            const routeStrong = routeEvents.filter((e) => ((e.payload as EventPayload).accuracy as number | undefined ?? 0) >= 0.8).length;
            const rulePassed = interactionEvalEvents.filter((e) => Boolean((e.payload as EventPayload).rulePassed)).length;
            const wrongFirstDiff = interactionEvalEvents.filter((e) => (e.payload as EventPayload).errorType === 'wrong_first_difference').length;

            const classKnowledgeStates = classStudents.flatMap((s) => s.knowledgeSkillStates);
            const classDleValues = classKnowledgeStates.map((s) => s.latestDle).filter((v): v is number => typeof v === 'number');
            const classAvgDle = classDleValues.length ? classDleValues.reduce((sum, v) => sum + v, 0) / classDleValues.length : null;
            const classDurableCount = classKnowledgeStates.filter((s) => s.durabilityBand === 'DURABLE').length;
            const classAtRiskCount = classKnowledgeStates.filter((s) => s.durabilityBand === 'AT_RISK').length;
            const classInstructionalTimes = classKnowledgeStates
              .map((s) => s.latestInstructionalTimeMs)
              .filter((v): v is number => typeof v === 'number');
            const classAvgInstructionalTimeMs = classInstructionalTimes.length
              ? Math.round(classInstructionalTimes.reduce((sum, v) => sum + v, 0) / classInstructionalTimes.length)
              : null;

            const classAttempts = questionAttempts.filter((a) => {
              if (!classStudentIds.has(a.userId)) return false;
              if (classSubjectId && a.skill.subjectId !== classSubjectId) return false;
              return true;
            });
            const classRecentAttempts = classAttempts.filter((a) => a.occurredAt >= since);
            const classPreviousAttempts = classAttempts.filter((a) => a.occurredAt < since);
            const classTrend = trendDirection(
              efficiencyScore(classRecentAttempts),
              efficiencyScore(classPreviousAttempts)
            );

            const studentRows = cls.enrollments.map((enrollment) => {
              const student = enrollment.student;
              const studentEvents = classEvents.filter((e) => e.studentUserId === student.id);
              const studentQuestion = studentEvents.filter((e) => e.name === 'question_answered').length;
              const studentStep = studentEvents.filter((e) => e.name === 'step_checkpoint_attempted');
              const studentEval = studentEvents.filter((e) => e.name === 'step_interaction_evaluated');
              const studentInterventions = studentEvents.filter((e) => e.name === 'intervention_flagged').length;

              const masteryVals = student.skillMasteries.map((m) => m.mastery);
              const masteryAvg = masteryVals.length ? Math.round((masteryVals.reduce((a, b) => a + b, 0) / masteryVals.length) * 100) : 0;
              const checkpointHits = studentStep.filter((e) => Boolean((e.payload as EventPayload).correct)).length;
              const evalPass = studentEval.filter((e) => Boolean((e.payload as EventPayload).rulePassed)).length;
              const evalWrong = studentEval.filter((e) => (e.payload as EventPayload).errorType === 'wrong_first_difference').length;
              const studentDleValues = student.knowledgeSkillStates
                .map((s) => s.latestDle)
                .filter((v): v is number => typeof v === 'number');
              const studentAvgDle = studentDleValues.length
                ? studentDleValues.reduce((sum, v) => sum + v, 0) / studentDleValues.length
                : null;
              const studentDurability =
                student.knowledgeSkillStates.find((s) => s.durabilityBand === 'AT_RISK')?.durabilityBand ??
                student.knowledgeSkillStates.find((s) => s.durabilityBand === 'DEVELOPING')?.durabilityBand ??
                student.knowledgeSkillStates.find((s) => s.durabilityBand === 'DURABLE')?.durabilityBand ??
                null;

              const checkpointRateValue = studentStep.length > 0 ? checkpointHits / studentStep.length : 1;
              const interactionPassRateValue = studentEval.length > 0 ? evalPass / studentEval.length : 1;
              const { riskLevel, riskScore } = getRiskModel({
                checkpointRate: checkpointRateValue,
                interactionPassRate: interactionPassRateValue,
                interventions: studentInterventions,
                wrongFirstDiff: evalWrong,
              });
              const studentAttempts = questionAttempts.filter((a) => {
                if (a.userId !== student.id) return false;
                if (classSubjectId && a.skill.subjectId !== classSubjectId) return false;
                return true;
              });
              const studentTrend = trendDirection(
                efficiencyScore(studentAttempts.filter((a) => a.occurredAt >= since)),
                efficiencyScore(studentAttempts.filter((a) => a.occurredAt < since))
              );
              const needsAction = riskLevel !== 'GREEN';

              return {
                id: student.id,
                name: student.name ?? student.email ?? student.id,
                observeStudentId: enrollment.studentProfile?.externalStudentId ?? '—',
                masteryAvg,
                questionCount: studentQuestion,
                checkpointRate: pct(checkpointHits, studentStep.length),
                interactionPassRate: pct(evalPass, studentEval.length),
                wrongFirstDiff: evalWrong,
                interventions: studentInterventions,
                riskLevel,
                riskScore,
                studentAvgDle,
                studentDurability,
                studentTrend,
                needsAction,
              };
            });

            const requiringAction = studentRows.filter((s) => s.needsAction);

            return (
              <section key={cls.id} className="anx-panel p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--anx-text)' }}>{cls.name}</h2>
                    <p className="text-xs" style={{ color: 'var(--anx-text-muted)' }}>
                      {cls.yearGroup ?? '—'} · {cls.subjectSlug ?? '—'} · Observe class id: {cls.externalClassId}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="anx-stat"><p className="anx-stat-label">Students</p><p className="anx-stat-value">{classStudents.length}</p></div>
                  <div className="anx-stat"><p className="anx-stat-label">Average mastery</p><p className="anx-stat-value">{avgMastery}%</p></div>
                  <div className="anx-stat"><p className="anx-stat-label">Stable learners</p><p className="anx-stat-value">{stableCount}</p></div>
                  <div className="anx-stat"><p className="anx-stat-label">Review due</p><p className="anx-stat-value">{reviewDueCount}</p></div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-xl border border-[var(--anx-border)] bg-[var(--anx-primary-soft)] p-3"><p className="anx-stat-label text-[var(--anx-primary)]">Question events</p><p className="text-lg font-semibold text-[var(--anx-text)]">{questionEvents.length}</p></div>
                  <div className="rounded-xl border border-[var(--anx-border)] bg-[var(--anx-primary-soft)] p-3"><p className="anx-stat-label text-[var(--anx-primary)]">Checkpoint accuracy</p><p className="text-lg font-semibold text-[var(--anx-text)]">{pct(checkpointCorrect, stepAttemptEvents.length)}</p></div>
                  <div className="rounded-xl border border-[var(--anx-border)] bg-[var(--anx-primary-soft)] p-3"><p className="anx-stat-label text-[var(--anx-primary)]">Interaction rule pass</p><p className="text-lg font-semibold text-[var(--anx-text)]">{pct(rulePassed, interactionEvalEvents.length)}</p></div>
                  <div className="rounded-xl border border-[var(--anx-border)] bg-[var(--anx-primary-soft)] p-3"><p className="anx-stat-label text-[var(--anx-primary)]">Strong routes (≥80%)</p><p className="text-lg font-semibold text-[var(--anx-text)]">{pct(routeStrong, routeEvents.length)}</p></div>
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3"><p className="text-xs text-rose-700">Wrong first-difference</p><p className="text-lg font-semibold text-rose-900">{wrongFirstDiff}</p></div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-lg border border-teal-200 bg-teal-50 p-3"><p className="text-xs text-teal-700">Avg DLE (latest)</p><p className="text-lg font-semibold text-teal-900">{classAvgDle != null ? classAvgDle.toFixed(2) : '—'}</p></div>
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3" title={MOMENTUM_HELP}><p className="text-xs text-sky-700">DLE momentum</p><p className="text-lg font-semibold text-sky-900">{trendBadge(classTrend)}</p><p className="mt-1 text-[11px] text-sky-700">proxy metric</p></div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs text-emerald-700">Durable states</p><p className="text-lg font-semibold text-emerald-900">{classDurableCount}</p></div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-xs text-amber-700">At-risk states</p><p className="text-lg font-semibold text-amber-900">{classAtRiskCount}</p></div>
                  <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3"><p className="text-xs text-cyan-700">Avg instructional time</p><p className="text-lg font-semibold text-cyan-900">{classAvgInstructionalTimeMs != null ? `${Math.round(classAvgInstructionalTimeMs / 1000)}s` : '—'}</p></div>
                </div>

                <div className="mt-4 rounded-xl border px-4 py-3" style={{ borderColor: '#fbbf24', background: 'var(--anx-warning-soft)' }}>
                  <p className="anx-section-label" style={{ color: '#92400e' }}>Students requiring action</p>
                  <p className="mt-1.5 text-sm" style={{ color: '#78350f' }}>
                    {requiringAction.length === 0
                      ? 'No high-priority students in this filter window.'
                      : requiringAction.map((s) => `${s.name} (${s.riskLevel})`).join(', ')}
                  </p>
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border" style={{ borderColor: 'var(--anx-border)' }}>
                  <div className="border-b px-4 py-2.5 anx-section-label" style={{ borderColor: 'var(--anx-border-subtle)', background: 'var(--anx-surface-soft)' }}>Student drilldown (actionable)</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-white text-xs" style={{ color: 'var(--anx-text-muted)' }}>
                        <tr><th className="px-3 py-2 text-left">Student</th><th className="px-3 py-2 text-left">Observe ID</th><th className="px-3 py-2 text-left">Risk</th><th className="px-3 py-2 text-left">DLE</th><th className="px-3 py-2 text-left">Durability</th><th className="px-3 py-2 text-left">Trend</th><th className="px-3 py-2 text-left">Mastery</th><th className="px-3 py-2 text-left">Questions</th><th className="px-3 py-2 text-left">Checkpoint</th><th className="px-3 py-2 text-left">Interaction pass</th><th className="px-3 py-2 text-left">Wrong first-diff</th><th className="px-3 py-2 text-left">Interventions</th></tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: 'var(--anx-border-subtle)' }}>
                        {studentRows.map((row) => (
                          <tr key={row.id} className={row.needsAction ? 'bg-amber-50/60' : ''}>
                            <td className="px-3 py-2 text-slate-800">{row.name}</td><td className="px-3 py-2 font-mono text-xs text-slate-600">{row.observeStudentId}</td><td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${row.riskLevel === 'RED' ? 'bg-rose-100 text-rose-800' : row.riskLevel === 'AMBER' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{row.riskLevel} ({row.riskScore})</span></td><td className="px-3 py-2 font-mono text-xs">{row.studentAvgDle != null ? row.studentAvgDle.toFixed(2) : '—'}</td><td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs font-semibold ${row.studentDurability === 'AT_RISK' ? 'bg-rose-100 text-rose-800' : row.studentDurability === 'DEVELOPING' ? 'bg-amber-100 text-amber-800' : row.studentDurability === 'DURABLE' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{row.studentDurability ?? '—'}</span></td><td className="px-3 py-2 text-xs text-sky-800">{trendBadge(row.studentTrend)}</td><td className="px-3 py-2">{row.masteryAvg}%</td><td className="px-3 py-2">{row.questionCount}</td><td className="px-3 py-2">{row.checkpointRate}</td><td className="px-3 py-2">{row.interactionPassRate}</td><td className="px-3 py-2 text-rose-700">{row.wrongFirstDiff}</td><td className="px-3 py-2">{row.interventions}</td>
                          </tr>
                        ))}
                        {studentRows.length === 0 && <tr><td colSpan={12} className="px-3 py-8 text-center text-slate-400">No students enrolled in this class yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
    </LearningPageShell>
  );
}
