import React from 'react';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/features/auth/authOptions';
import { prisma } from '@/db/prisma';
import { scoreAttempt } from '@/features/knowledge-state/scoreAttempt';
import { updateSkillState, type KnowledgeState } from '@/features/knowledge-state/updateSkillState';
import { decideNextQuestion, NEXT_QUESTION_POLICY_VERSION } from '@/features/knowledge-state/nextQuestionPolicy';

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function fmtDate(value: Date | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

const DEFAULT_STATE: KnowledgeState = {
  masteryProbability: 0.35,
  forgettingRate: 0.12,
  halfLifeDays: 5.776226504666211,
  retrievalStrength: 0.3,
  transferAbility: 0.2,
  confidence: 0.1,
  evidenceCount: 0,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastReviewAt: null,
};

export default async function AdminKnowledgeStatePage({
  searchParams,
}: {
  searchParams?: Promise<{ userId?: string; skillId?: string; q?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const role = (session.user as { role: string }).role;
  if (role !== 'ADMIN') redirect('/dashboard');

  const params = searchParams ? await searchParams : {};
  const query = (params.q ?? '').trim().toLowerCase();

  const combos = await prisma.questionAttempt.findMany({
    distinct: ['userId', 'skillId'],
    orderBy: { occurredAt: 'desc' },
    take: 40,
    include: {
      user: { select: { id: true, name: true, email: true } },
      skill: { select: { id: true, code: true, name: true } },
    },
  });

  const filteredCombos = query
    ? combos.filter((c) => {
        const userName = (c.user.name ?? '').toLowerCase();
        const email = (c.user.email ?? '').toLowerCase();
        const skillCode = c.skill.code.toLowerCase();
        const skillName = c.skill.name.toLowerCase();
        return userName.includes(query) || email.includes(query) || skillCode.includes(query) || skillName.includes(query);
      })
    : combos;

  const selected =
    filteredCombos.find((c) => c.userId === params.userId && c.skillId === params.skillId) ??
    filteredCombos[0] ??
    combos[0] ??
    null;

  if (!selected) {
    return (
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-5xl px-4">
          <h1 className="mb-3 text-2xl font-bold text-gray-900">Knowledge State Debug</h1>
          <p className="text-gray-500">No knowledge-state attempts yet.</p>
        </div>
      </main>
    );
  }

  const [state, attempts, reviews] = await Promise.all([
    prisma.studentSkillState.findUnique({
      where: { userId_skillId: { userId: selected.userId, skillId: selected.skillId } },
    }),
    prisma.questionAttempt.findMany({
      where: { userId: selected.userId, skillId: selected.skillId },
      include: {
        item: { select: { id: true, question: true } },
      },
      orderBy: { occurredAt: 'desc' },
      take: 15,
    }),
    prisma.skillReview.findMany({
      where: { userId: selected.userId, skillId: selected.skillId },
      orderBy: { scheduledFor: 'desc' },
      take: 8,
    }),
  ]);

  const attemptsChronological = [...attempts].reverse();
  let rollingState: KnowledgeState = DEFAULT_STATE;

  const traces = attemptsChronological.map((attempt) => {
    const evidence = scoreAttempt({
      correct: attempt.correct,
      responseTimeMs: attempt.responseTimeMs,
      hintsUsed: attempt.hintsUsed,
      supportLevel: attempt.supportLevel,
      questionType: attempt.questionType,
      isTransferItem: attempt.isTransferItem,
      isMixedItem: attempt.isMixedItem,
      isReviewItem: attempt.isReviewItem,
    });

    const before = rollingState;
    const after = updateSkillState({
      state: before,
      evidence,
      attempt: {
        timestamp: attempt.occurredAt,
        correct: attempt.correct,
        isTransferItem: attempt.isTransferItem,
        isReviewItem: attempt.isReviewItem,
        expectedRetention: before.retrievalStrength,
        observedRetention: attempt.correct ? 1 : 0,
      },
    });

    const recommendation = decideNextQuestion({ state: after, now: attempt.occurredAt });
    rollingState = after;

    return {
      attempt,
      evidence,
      before,
      after,
      recommendation,
    };
  });

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl space-y-6 px-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Knowledge State Debug</h1>
          <a href="/admin/interventions" className="text-sm text-blue-600 hover:underline">
            ← Interventions
          </a>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">Select learner + skill</div>
          <form className="mb-3" method="GET" action="/admin/knowledge-state">
            <input
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Filter by learner name, email, skill code or skill name"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </form>
          <div className="mb-2 text-xs text-gray-500">
            Showing {filteredCombos.length} of {combos.length} combinations
          </div>
          <div className="flex flex-wrap gap-2">
            {filteredCombos.map((combo) => {
              const active = combo.userId === selected.userId && combo.skillId === selected.skillId;
              const queryParam = params.q ? `&q=${encodeURIComponent(params.q)}` : '';
              return (
                <a
                  key={`${combo.userId}-${combo.skillId}`}
                  href={`/admin/knowledge-state?userId=${combo.userId}&skillId=${combo.skillId}${queryParam}`}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    active ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-700'
                  }`}
                >
                  {(combo.user.name ?? combo.user.email ?? combo.user.id)} · {combo.skill.code}
                </a>
              );
            })}
          </div>
          {filteredCombos.length === 0 && (
            <p className="mt-3 text-xs text-amber-700">No matches for “{params.q}”. Clear the filter to see all.</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Mastery</div>
            <div className="mt-2 text-2xl font-semibold text-emerald-600">{state ? pct(state.masteryProbability) : '—'}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Retrieval / Transfer</div>
            <div className="mt-2 text-sm text-gray-700">
              {state ? `${pct(state.retrievalStrength)} / ${pct(state.transferAbility)}` : '—'}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Half-life / Forgetting</div>
            <div className="mt-2 text-sm text-gray-700">
              {state ? `${state.halfLifeDays.toFixed(1)}d / ${state.forgettingRate.toFixed(3)}` : '—'}
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="text-xs text-gray-500">Evidence / Policy</div>
            <div className="mt-2 text-sm text-gray-700">
              {state ? `${state.evidenceCount} attempts` : '—'} · {NEXT_QUESTION_POLICY_VERSION}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Recent evidence + rule trace (latest 15 attempts)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-2 py-2 text-left">When</th>
                  <th className="px-2 py-2 text-left">Item</th>
                  <th className="px-2 py-2 text-left">Context</th>
                  <th className="px-2 py-2 text-left">Signals</th>
                  <th className="px-2 py-2 text-left">State Δ</th>
                  <th className="px-2 py-2 text-left">Next policy</th>
                </tr>
              </thead>
              <tbody>
                {traces
                  .slice()
                  .reverse()
                  .map((trace) => (
                    <tr key={trace.attempt.id} className="border-b border-gray-100 align-top">
                      <td className="px-2 py-2 text-gray-500">{fmtDate(trace.attempt.occurredAt)}</td>
                      <td className="px-2 py-2 text-gray-700">
                        <div className="font-mono text-[11px] text-gray-400">{trace.attempt.item.id}</div>
                        <div className="max-w-[220px] truncate">{trace.attempt.item.question}</div>
                      </td>
                      <td className="px-2 py-2 text-gray-600">
                        <div>{trace.attempt.correct ? '✅ correct' : '❌ incorrect'}</div>
                        <div>{trace.attempt.questionType} · {trace.attempt.supportLevel}</div>
                        <div>
                          {trace.attempt.isTransferItem ? 'transfer' : 'non-transfer'} · {trace.attempt.isReviewItem ? 'review' : 'normal'}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-gray-600">
                        <div>M {trace.evidence.masterySignal.toFixed(2)}</div>
                        <div>R {trace.evidence.retrievalSignal.toFixed(2)}</div>
                        <div>T {trace.evidence.transferSignal.toFixed(2)}</div>
                        <div>F {trace.evidence.forgettingSignal.toFixed(2)}</div>
                        <div>Rel {trace.evidence.reliabilitySignal.toFixed(2)}</div>
                      </td>
                      <td className="px-2 py-2 text-gray-600">
                        <div>M {trace.before.masteryProbability.toFixed(2)} → {trace.after.masteryProbability.toFixed(2)}</div>
                        <div>R {trace.before.retrievalStrength.toFixed(2)} → {trace.after.retrievalStrength.toFixed(2)}</div>
                        <div>T {trace.before.transferAbility.toFixed(2)} → {trace.after.transferAbility.toFixed(2)}</div>
                        <div>H {trace.before.halfLifeDays.toFixed(1)}d → {trace.after.halfLifeDays.toFixed(1)}d</div>
                      </td>
                      <td className="px-2 py-2 text-gray-600">
                        <div className="font-semibold text-gray-700">{trace.recommendation.questionType}</div>
                        <div>{trace.recommendation.supportLevel}</div>
                        <div className="max-w-[220px]">{trace.recommendation.rationale}</div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Review schedule (latest 8)</h2>
          <div className="space-y-2 text-xs text-gray-700">
            {reviews.length === 0 ? (
              <p className="text-gray-400">No review records yet.</p>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <div>Scheduled: {fmtDate(review.scheduledFor)}</div>
                  <div>Completed: {fmtDate(review.completedAt)}</div>
                  <div>
                    Success: {review.successScore === null || review.successScore === undefined ? '—' : review.successScore.toFixed(2)} · Days since last exposure:{' '}
                    {review.daysSinceLastExposure === null || review.daysSinceLastExposure === undefined
                      ? '—'
                      : review.daysSinceLastExposure.toFixed(1)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
