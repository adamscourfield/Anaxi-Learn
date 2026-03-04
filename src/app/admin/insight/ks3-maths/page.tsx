import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import { prisma } from '@/db/prisma';

export default async function InsightDashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const role = (session.user as { role: string }).role;
  if (role !== 'ADMIN') redirect('/dashboard');

  const subject = await prisma.subject.findUnique({ where: { slug: 'ks3-maths' } });
  if (!subject) return <div>Subject not found</div>;

  const skills = await prisma.skill.findMany({
    where: { subjectId: subject.id },
    include: {
      masteries: { select: { mastery: true, confirmedCount: true, userId: true } },
    },
    orderBy: { sortOrder: 'asc' },
  });

  // A) Coverage by strand
  const strandMap = new Map<string, { totalStudents: number; stableStudents: number; masteries: number[] }>();
  for (const skill of skills) {
    const strand = skill.strand;
    if (!strandMap.has(strand)) strandMap.set(strand, { totalStudents: 0, stableStudents: 0, masteries: [] });
    const entry = strandMap.get(strand)!;
    for (const m of skill.masteries) {
      entry.totalStudents++;
      if (m.mastery > 0) entry.masteries.push(m.mastery);
      if (m.confirmedCount >= 2 && m.mastery >= 0.85) entry.stableStudents++;
    }
  }

  // D) Fragile skills: highest share of students mastery < 0.6
  const fragileSkills = skills
    .map((skill) => {
      const total = skill.masteries.length;
      if (total === 0) return { skill, fragileShare: 0 };
      const fragile = skill.masteries.filter((m) => m.mastery < 0.6).length;
      return { skill, fragileShare: fragile / total };
    })
    .filter((s) => s.skill.masteries.length > 0)
    .sort((a, b) => b.fragileShare - a.fragileShare)
    .slice(0, 10);

  // B) Review success by interval bucket
  const reviewEvents = await prisma.event.findMany({
    where: { name: 'review_completed', subjectId: subject.id },
    select: { payload: true },
  });

  const buckets: Record<string, { pass: number; fail: number }> = {
    '1d': { pass: 0, fail: 0 },
    '3d': { pass: 0, fail: 0 },
    '7d': { pass: 0, fail: 0 },
    '14d': { pass: 0, fail: 0 },
  };
  // For now just count pass/fail totals (interval bucket detection requires more data)
  for (const e of reviewEvents) {
    const p = e.payload as { outcome?: string };
    const outcome = p?.outcome === 'pass' ? 'pass' : 'fail';
    // Default to 7d bucket without interval info
    buckets['7d'][outcome]++;
  }

  // C) Time to stable mastery (median days from first attempt to confirmedCount=2)
  const stableSkillMasteries = await prisma.skillMastery.findMany({
    where: { confirmedCount: { gte: 2 }, skill: { subjectId: subject.id } },
    select: { createdAt: true, updatedAt: true },
  });
  let medianDays = 0;
  if (stableSkillMasteries.length > 0) {
    const days = stableSkillMasteries.map((m) => {
      const diff = m.updatedAt.getTime() - m.createdAt.getTime();
      return diff / (1000 * 60 * 60 * 24);
    }).sort((a, b) => a - b);
    medianDays = days[Math.floor(days.length / 2)] ?? 0;
  }

  const strandEntries = Array.from(strandMap.entries()).sort(([a], [b]) => a.localeCompare(b));

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 space-y-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Insight Dashboard — KS3 Maths</h1>
          <div className="flex items-center gap-4 text-sm">
            <a href="/admin/content/ks3-maths" className="text-blue-600 hover:underline">
              → Content Verification
            </a>
            <a href="/admin/interventions" className="text-blue-600 hover:underline">
              → Interventions
            </a>
          </div>
        </div>

        {/* A) Coverage by strand */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">A) Coverage &amp; Progress by Strand</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Strand</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Avg Mastery</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">% Stable (confirmedCount ≥ 2)</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Total Entries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {strandEntries.map(([strand, data]) => {
                  const avgMastery = data.masteries.length > 0
                    ? data.masteries.reduce((s, v) => s + v, 0) / data.masteries.length
                    : 0;
                  const stablePct = data.totalStudents > 0
                    ? Math.round((data.stableStudents / data.totalStudents) * 100)
                    : 0;
                  return (
                    <tr key={strand} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">{strand}</td>
                      <td className="px-4 py-3">{Math.round(avgMastery * 100)}%</td>
                      <td className="px-4 py-3">{stablePct}%</td>
                      <td className="px-4 py-3 text-gray-400">{data.totalStudents}</td>
                    </tr>
                  );
                })}
                {strandEntries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">No mastery data yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* B) Review success by bucket */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">B) Retention Proxy — Review Success Rate</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Interval Bucket</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Pass</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fail</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(buckets).map(([bucket, counts]) => {
                  const total = counts.pass + counts.fail;
                  const rate = total > 0 ? Math.round((counts.pass / total) * 100) : 0;
                  return (
                    <tr key={bucket} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{bucket}</td>
                      <td className="px-4 py-3 text-green-600">{counts.pass}</td>
                      <td className="px-4 py-3 text-red-500">{counts.fail}</td>
                      <td className="px-4 py-3">{total > 0 ? `${rate}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* C) Time to stable mastery */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">C) Time to Stable Mastery</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-gray-700">
              Median days from first attempt to stable mastery (confirmedCount ≥ 2):{' '}
              <span className="font-bold">
                {stableSkillMasteries.length > 0 ? `${medianDays.toFixed(1)} days` : 'No data yet'}
              </span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Based on {stableSkillMasteries.length} stable skill mastery entr{stableSkillMasteries.length !== 1 ? 'ies' : 'y'}.
            </p>
          </div>
        </section>

        {/* D) Fragile skills */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">D) Top Fragile Skills (mastery &lt; 60%)</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Skill</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Strand</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">% Students Fragile</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Total Students</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {fragileSkills.map(({ skill, fragileShare }) => (
                  <tr key={skill.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-400">{skill.code}</span>{' '}
                      {skill.name}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{skill.strand}</span>
                    </td>
                    <td className="px-4 py-3 text-red-600 font-semibold">
                      {Math.round(fragileShare * 100)}%
                    </td>
                    <td className="px-4 py-3 text-gray-400">{skill.masteries.length}</td>
                  </tr>
                ))}
                {fragileSkills.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">No fragile skills detected.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
