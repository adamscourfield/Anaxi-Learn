import React from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import { prisma } from '@/db/prisma';
import { LEARNING_CONFIG } from '@/features/config/learningConfig';

export default async function AdminInterventionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const role = (session.user as { role: string }).role;
  if (role !== 'ADMIN') redirect('/dashboard');

  const flags = await prisma.interventionFlag.findMany({
    where: { isResolved: false },
    include: {
      user: { select: { name: true, email: true } },
      skill: { select: { code: true, name: true, strand: true } },
      subject: { select: { title: true, slug: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get mastery and recent attempt counts for each flag
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const flagsWithStats = await Promise.all(
    flags.map(async (flag) => {
      const [mastery, recentAttempts] = await Promise.all([
        prisma.skillMastery.findUnique({
          where: { userId_skillId: { userId: flag.userId, skillId: flag.skillId } },
          select: { mastery: true },
        }),
        prisma.attempt.count({
          where: {
            userId: flag.userId,
            item: { skills: { some: { skillId: flag.skillId } } },
            createdAt: { gte: sevenDaysAgo },
          },
        }),
      ]);
      return { ...flag, masteryValue: mastery?.mastery ?? 0, recentAttempts };
    })
  );

  const recentRouteEvents = await prisma.event.findMany({
    where: {
      createdAt: { gte: sevenDaysAgo },
      name: { in: ['diagnostic_route_recommended', 'shadow_pair_passed', 'shadow_pair_failed', 'intervention_flagged'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const routeSummary = recentRouteEvents.reduce(
    (acc, event) => {
      const payload = (event.payload ?? {}) as { route?: 'A' | 'B' | 'C' | null; status?: 'secure' | 'route'; skillCode?: string };

      if (event.name === 'diagnostic_route_recommended') {
        if (payload.status === 'secure') acc.secureFastPass += 1;
        if (payload.route === 'A') acc.routeA += 1;
        if (payload.route === 'B') acc.routeB += 1;
        if (payload.route === 'C') acc.routeC += 1;
      }
      if (event.name === 'shadow_pair_passed') acc.shadowPairPassed += 1;
      if (event.name === 'shadow_pair_failed') acc.shadowPairFailed += 1;
      if (event.name === 'intervention_flagged') acc.interventionFlagged += 1;
      return acc;
    },
    {
      routeA: 0,
      routeB: 0,
      routeC: 0,
      secureFastPass: 0,
      shadowPairPassed: 0,
      shadowPairFailed: 0,
      interventionFlagged: 0,
    }
  );

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Intervention Flags</h1>
          <div className="flex items-center gap-4">
            <a href="/admin/knowledge-state" className="text-sm text-blue-600 hover:underline">
              → Knowledge State Debug
            </a>
            <a href={`/admin/insight/${LEARNING_CONFIG.defaultSubjectSlug}`} className="text-sm text-blue-600 hover:underline">
              → Insight Dashboard
            </a>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Route recommendations (7d)</div>
            <div className="mt-2 text-sm text-gray-700">A: {routeSummary.routeA} · B: {routeSummary.routeB} · C: {routeSummary.routeC}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Secure fast-pass (7d)</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-600">{routeSummary.secureFastPass}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Shadow pairs (7d)</div>
            <div className="mt-2 text-sm text-gray-700">Passed: {routeSummary.shadowPairPassed} · Failed: {routeSummary.shadowPairFailed}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Interventions flagged (7d)</div>
            <div className="mt-2 text-2xl font-semibold text-rose-600">{routeSummary.interventionFlagged}</div>
          </div>
        </div>

        {flagsWithStats.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No active intervention flags.</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Student</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Skill</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Strand</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Mastery</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Attempts (7d)</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Recommended Action</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {flagsWithStats.map((flag) => (
                  <tr key={flag.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>{flag.user.name ?? '—'}</div>
                      <div className="text-xs text-gray-400">{flag.user.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-gray-500">{flag.skill.code}</div>
                      <div className="text-gray-700">{flag.skill.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{flag.skill.strand}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-red-600 font-semibold">
                        {Math.round(flag.masteryValue * 100)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{flag.recentAttempts}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      Consider 1:1 support or worked examples for {flag.skill.name}
                    </td>
                    <td className="px-4 py-3">
                      <form action="/api/admin/interventions/resolve" method="POST">
                        <input type="hidden" name="flagId" value={flag.id} />
                        <button
                          type="submit"
                          className="px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 transition-colors"
                        >
                          Resolve
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
