import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import { prisma } from '@/db/prisma';

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
                        select: { mastery: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-gray-50 py-10 sm:py-12">
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Teacher Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">Observe-linked class overview for {user.name ?? user.email}</p>

        {!teacherProfile ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            No teacher profile linked yet. Add a TeacherProfile row mapped to your Observe teacher id.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p><span className="font-semibold">Observe Teacher ID:</span> {teacherProfile.externalTeacherId}</p>
              <p><span className="font-semibold">Observe School ID:</span> {teacherProfile.externalSchoolId ?? '—'}</p>
            </div>

            {teacherProfile.classrooms.map((tc) => {
              const cls = tc.classroom;
              const students = cls.enrollments.map((e) => e.student);
              const masteryVals = students.flatMap((s) => s.skillMasteries.map((m) => m.mastery));
              const avgMastery = masteryVals.length === 0 ? 0 : Math.round((masteryVals.reduce((a, b) => a + b, 0) / masteryVals.length) * 100);

              return (
                <section key={cls.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{cls.name}</h2>
                      <p className="text-xs text-slate-500">
                        {cls.yearGroup ?? '—'} · {cls.subjectSlug ?? '—'} · Observe class id: {cls.externalClassId}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Students</p>
                      <p className="text-lg font-semibold text-slate-900">{students.length}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Avg mastery</p>
                      <p className="text-xl font-bold text-slate-900">{avgMastery}%</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Linked source</p>
                      <p className="text-sm font-semibold text-slate-900">{cls.externalSource}</p>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
