import React from 'react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { redirect } from 'next/navigation';
import { prisma } from '@/db/prisma';
import { LEARNING_CONFIG } from '@/features/config/learningConfig';
import { AdminReteachPolicyPanel } from '@/features/reteach/AdminReteachPolicyPanel';

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

  const sevenDaysReteachAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [reteachEscalations, policyUpdates] = await Promise.all([
    prisma.event.findMany({
      where: {
        name: 'reteach_escalated',
        createdAt: { gte: sevenDaysReteachAgo },
      },
      include: {
        actor: { select: { name: true, email: true } },
        skill: { select: { code: true, name: true, strand: true } },
        subject: { select: { title: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.event.findMany({
      where: { name: 'reteach_policy_updated' },
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const reteachExceptions = await Promise.all(
    reteachEscalations.map(async (event) => {
      const payload = (event.payload ?? {}) as {
        assignedPathId?: string;
        reason?: string;
        reasonCode?: string;
        interventionSuggestions?: Array<{ code?: string; label?: string; detail?: string }>;
      };
      const assignedPathId = payload.assignedPathId;

      const [attemptCount, latestGate] = await Promise.all([
        assignedPathId
          ? prisma.event.count({
              where: {
                name: 'reteach_attempt_recorded',
                studentUserId: event.studentUserId ?? undefined,
                skillId: event.skillId ?? undefined,
                payload: { path: ['assignedPathId'], equals: assignedPathId },
              },
            })
          : Promise.resolve(0),
        assignedPathId
          ? prisma.event.findFirst({
              where: {
                name: 'reteach_gate_evaluated',
                studentUserId: event.studentUserId ?? undefined,
                skillId: event.skillId ?? undefined,
                payload: { path: ['assignedPathId'], equals: assignedPathId },
              },
              orderBy: { createdAt: 'desc' },
              select: { payload: true },
            })
          : Promise.resolve(null),
      ]);

      const gatePayload = (latestGate?.payload ?? {}) as {
        checks?: { consecutiveIndependentCorrect?: number; independentCorrectRate?: number; delayedRetrievalOk?: boolean };
      };

      return {
        id: event.id,
        createdAt: event.createdAt,
        studentName: event.actor?.name ?? '—',
        studentEmail: event.actor?.email ?? '—',
        skillCode: event.skill?.code ?? '—',
        skillName: event.skill?.name ?? 'Unknown skill',
        strand: event.skill?.strand ?? '—',
        subjectTitle: event.subject?.title ?? '—',
        assignedPathId: assignedPathId ?? '—',
        reason: payload.reason ?? 'Reteach gate escalation',
        reasonCode: payload.reasonCode ?? null,
        suggestedActions: (payload.interventionSuggestions ?? []).filter((s) => s?.label).map((s) => s.label as string),
        attemptCount,
        checks: gatePayload.checks ?? null,
      };
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
    <main className="anx-shell">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--anx-text)' }}>Intervention Flags</h1>
          <div className="flex items-center gap-4">
            <a href="/admin/knowledge-state" className="anx-link">
              → Knowledge State Debug
            </a>
            <a href={`/admin/insight/${LEARNING_CONFIG.defaultSubjectSlug}`} className="anx-link">
              → Insight Dashboard
            </a>
          </div>
        </div>

        <div className="mb-6">
          <AdminReteachPolicyPanel />
        </div>

        <div className="anx-card-flat mb-6 overflow-hidden">
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--anx-border-subtle)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--anx-text)' }}>Recent policy changes</h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--anx-text-secondary)' }}>Last 10 updates to Phase 9 thresholds (audit trail).</p>
          </div>
          {policyUpdates.length === 0 ? (
            <div className="px-4 py-4 text-xs" style={{ color: 'var(--anx-text-muted)' }}>No policy updates yet.</div>
          ) : (
            <div>
              {policyUpdates.map((event, index) => (
                <div key={event.id ?? `policy-update-${index}`} className="border-t px-4 py-3 text-xs" style={{ borderColor: 'var(--anx-border-subtle)', color: 'var(--anx-text-secondary)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium" style={{ color: 'var(--anx-text)' }}>{event.actor?.name ?? event.actor?.email ?? 'Admin'}</span>
                    <span style={{ color: 'var(--anx-text-muted)' }}>{event.createdAt ? event.createdAt.toISOString().replace('T', ' ').slice(0, 16) : 'Unknown time'}</span>
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded p-2 text-[11px]" style={{ background: 'var(--anx-surface-soft)', color: 'var(--anx-text-secondary)' }}>{JSON.stringify(event.payload, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="anx-stat">
            <div className="anx-stat-label">Route recommendations (7d)</div>
            <div className="mt-2 text-sm" style={{ color: 'var(--anx-text-secondary)' }}>A: {routeSummary.routeA} · B: {routeSummary.routeB} · C: {routeSummary.routeC}</div>
          </div>
          <div className="anx-stat">
            <div className="anx-stat-label">Secure fast-pass (7d)</div>
            <div className="mt-2 text-2xl font-semibold" style={{ color: 'var(--anx-success)' }}>{routeSummary.secureFastPass}</div>
          </div>
          <div className="anx-stat">
            <div className="anx-stat-label">Shadow pairs (7d)</div>
            <div className="mt-2 text-sm" style={{ color: 'var(--anx-text-secondary)' }}>Passed: {routeSummary.shadowPairPassed} · Failed: {routeSummary.shadowPairFailed}</div>
          </div>
          <div className="anx-stat">
            <div className="anx-stat-label">Interventions flagged (7d)</div>
            <div className="mt-2 text-2xl font-semibold" style={{ color: 'var(--anx-danger)' }}>{routeSummary.interventionFlagged}</div>
          </div>
        </div>

        <div className="anx-card-flat mb-6 overflow-hidden" style={{ borderColor: 'var(--anx-primary)' }}>
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--anx-primary)', background: 'var(--anx-primary-soft)' }}>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--anx-text)' }}>Teacher Exceptions · Reteach Escalations (7d)</h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--anx-primary)' }}>Only students who did not recover through automated reteach loops appear here.</p>
          </div>
          {reteachExceptions.length === 0 ? (
            <div className="px-4 py-6 text-sm" style={{ color: 'var(--anx-text-muted)' }}>No reteach escalations in the last 7 days.</div>
          ) : (
            <div>
              {reteachExceptions.map((ex) => (
                <div key={ex.id} className="border-t px-4 py-3" style={{ borderColor: 'var(--anx-border-subtle)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--anx-text)' }}>
                        {ex.studentName} <span style={{ color: 'var(--anx-text-muted)' }}>({ex.studentEmail})</span>
                      </p>
                      <p className="text-xs" style={{ color: 'var(--anx-text-secondary)' }}>
                        {ex.subjectTitle} · {ex.skillCode} {ex.skillName} · {ex.strand}
                      </p>
                    </div>
                    <span className="anx-badge anx-badge-red">
                      Escalated
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4" style={{ color: 'var(--anx-text-secondary)' }}>
                    <p>Attempts in loop: <span className="font-semibold">{ex.attemptCount}</span></p>
                    <p>Consecutive independent correct: <span className="font-semibold">{ex.checks?.consecutiveIndependentCorrect ?? 0}</span></p>
                    <p>Independent rate: <span className="font-semibold">{typeof ex.checks?.independentCorrectRate === 'number' ? `${Math.round(ex.checks.independentCorrectRate * 100)}%` : '—'}</span></p>
                    <p>Delayed retrieval: <span className="font-semibold">{ex.checks?.delayedRetrievalOk ? 'OK' : 'Not met'}</span></p>
                  </div>
                  <p className="mt-2 text-xs" style={{ color: 'var(--anx-text-secondary)' }}>Reason: {ex.reason}</p>
                  {ex.reasonCode && <p className="mt-1 text-xs" style={{ color: 'var(--anx-text-muted)' }}>Decision code: {ex.reasonCode}</p>}
                  <p className="mt-1 text-xs" style={{ color: 'var(--anx-primary)' }}>
                    Suggested teacher action:{' '}
                    {ex.suggestedActions.length > 0
                      ? ex.suggestedActions.join(' · ')
                      : 'run a 1:1 worked example, then assign a short independent retrieval check next session.'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {flagsWithStats.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--anx-text-faint)' }}>No active intervention flags.</div>
        ) : (
          <div className="anx-table-wrapper">
            <table className="anx-table">
              <thead>
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Student</th>
                  <th className="text-left px-4 py-3 font-medium">Skill</th>
                  <th className="text-left px-4 py-3 font-medium">Strand</th>
                  <th className="text-left px-4 py-3 font-medium">Mastery</th>
                  <th className="text-left px-4 py-3 font-medium">Attempts (7d)</th>
                  <th className="text-left px-4 py-3 font-medium">Recommended Action</th>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {flagsWithStats.map((flag) => (
                  <tr key={flag.id}>
                    <td className="px-4 py-3">
                      <div>{flag.user.name ?? '—'}</div>
                      <div className="text-xs" style={{ color: 'var(--anx-text-faint)' }}>{flag.user.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs" style={{ color: 'var(--anx-text-muted)' }}>{flag.skill.code}</div>
                      <div style={{ color: 'var(--anx-text-secondary)' }}>{flag.skill.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="anx-badge anx-badge-blue">{flag.skill.strand}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold" style={{ color: 'var(--anx-danger)' }}>
                        {Math.round(flag.masteryValue * 100)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{flag.recentAttempts}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--anx-text-muted)' }}>
                      Consider 1:1 support or worked examples for {flag.skill.name}
                    </td>
                    <td className="px-4 py-3">
                      <form action="/api/admin/interventions/resolve" method="POST">
                        <input type="hidden" name="flagId" value={flag.id} />
                        <button
                          type="submit"
                          className="anx-btn-secondary text-xs"
                          style={{ color: 'var(--anx-success)', borderColor: 'var(--anx-success)' }}
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
