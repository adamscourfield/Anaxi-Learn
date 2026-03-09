import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import { prisma } from '@/db/prisma';

type EventPayload = Record<string, unknown>;

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return '—';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export default async function TeacherDashboardPage() {
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
      <main className="min-h-screen bg-gray-50 py-10 sm:py-12">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Teacher Dashboard</h1>
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            No teacher profile linked yet. Add a TeacherProfile row mapped to your Observe teacher id.
          </div>
        </div>
      </main>
    );
  }

  const classIds = teacherProfile.classrooms.map((tc) => tc.classroom.id);
  const allStudentIds = [...new Set(
    teacherProfile.classrooms.flatMap((tc) => tc.classroom.enrollments.map((e) => e.studentUserId))
  )];

  const events = allStudentIds.length
    ? await prisma.event.findMany({
        where: {
          studentUserId: { in: allStudentIds },
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

  const subjectMap = new Map((await prisma.subject.findMany({ select: { id: true, slug: true } })).map((s) => [s.slug, s.id]));

  const now = new Date();

  return (
    <main className="min-h-screen bg-gray-50 py-10 sm:py-12">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Teacher Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">Observe-linked analytics for {user.name ?? user.email}</p>

        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p><span className="font-semibold">Observe Teacher ID:</span> {teacherProfile.externalTeacherId}</p>
          <p><span className="font-semibold">Observe School ID:</span> {teacherProfile.externalSchoolId ?? '—'}</p>
          <p><span className="font-semibold">Linked Classes:</span> {classIds.length}</p>
        </div>

        <div className="mt-6 space-y-6">
          {teacherProfile.classrooms.map((tc) => {
            const cls = tc.classroom;
            const classSubjectId = cls.subjectSlug ? subjectMap.get(cls.subjectSlug) : undefined;
            const classStudents = cls.enrollments.map((e) => e.student);
            const classStudentIds = new Set(classStudents.map((s) => s.id));

            const classEvents = events.filter((e) => {
              if (!e.studentUserId || !classStudentIds.has(e.studentUserId)) return false;
              if (!classSubjectId) return true;
              return e.subjectId === classSubjectId || e.subjectId == null;
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
            const wrongFirstDiff = interactionEvalEvents.filter(
              (e) => (e.payload as EventPayload).errorType === 'wrong_first_difference'
            ).length;

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
              };
            });

            return (
              <section key={cls.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{cls.name}</h2>
                    <p className="text-xs text-slate-500">
                      {cls.yearGroup ?? '—'} · {cls.subjectSlug ?? '—'} · Observe class id: {cls.externalClassId}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Students</p>
                    <p className="text-xl font-bold text-slate-900">{classStudents.length}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Average mastery</p>
                    <p className="text-xl font-bold text-slate-900">{avgMastery}%</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Stable learners</p>
                    <p className="text-xl font-bold text-slate-900">{stableCount}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Review due</p>
                    <p className="text-xl font-bold text-slate-900">{reviewDueCount}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                    <p className="text-xs text-indigo-700">Question events</p>
                    <p className="text-lg font-semibold text-indigo-900">{questionEvents.length}</p>
                  </div>
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                    <p className="text-xs text-indigo-700">Checkpoint accuracy</p>
                    <p className="text-lg font-semibold text-indigo-900">{pct(checkpointCorrect, stepAttemptEvents.length)}</p>
                  </div>
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                    <p className="text-xs text-indigo-700">Interaction rule pass</p>
                    <p className="text-lg font-semibold text-indigo-900">{pct(rulePassed, interactionEvalEvents.length)}</p>
                  </div>
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                    <p className="text-xs text-indigo-700">Strong routes (≥80%)</p>
                    <p className="text-lg font-semibold text-indigo-900">{pct(routeStrong, routeEvents.length)}</p>
                  </div>
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                    <p className="text-xs text-rose-700">Wrong first-difference</p>
                    <p className="text-lg font-semibold text-rose-900">{wrongFirstDiff}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Student drilldown (actionable)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-white text-xs text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Student</th>
                          <th className="px-3 py-2 text-left">Observe ID</th>
                          <th className="px-3 py-2 text-left">Mastery</th>
                          <th className="px-3 py-2 text-left">Questions</th>
                          <th className="px-3 py-2 text-left">Checkpoint</th>
                          <th className="px-3 py-2 text-left">Interaction pass</th>
                          <th className="px-3 py-2 text-left">Wrong first-diff</th>
                          <th className="px-3 py-2 text-left">Interventions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {studentRows.map((row) => (
                          <tr key={row.id}>
                            <td className="px-3 py-2 text-slate-800">{row.name}</td>
                            <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.observeStudentId}</td>
                            <td className="px-3 py-2">{row.masteryAvg}%</td>
                            <td className="px-3 py-2">{row.questionCount}</td>
                            <td className="px-3 py-2">{row.checkpointRate}</td>
                            <td className="px-3 py-2">{row.interactionPassRate}</td>
                            <td className="px-3 py-2 text-rose-700">{row.wrongFirstDiff}</td>
                            <td className="px-3 py-2">{row.interventions}</td>
                          </tr>
                        ))}
                        {studentRows.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-3 py-8 text-center text-slate-400">
                              No students enrolled in this class yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Data included deliberately: mastery, checkpoint quality, interaction-rule quality, route strength, and intervention signals.
                  Data excluded (for now): noisy raw clickstream and non-actionable volume metrics.
                </p>
              </section>
            );
          })}
        </div>

        {teacherProfile.classrooms.length === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No classes linked to this teacher profile yet.
          </div>
        )}
      </div>
    </main>
  );
}
