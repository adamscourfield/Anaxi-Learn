'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReteachSession } from './ReteachSession';
import type { ReteachPlan } from './reteachContent';
import { parseAnswerType, parseItemOptions, stripStudentQuestionLabel } from '@/features/items/itemMeta';
import { featureFlags } from '@/features/config/featureFlags';

interface Item {
  id: string;
  question: string;
  options: unknown;
  type?: string;
  answer: string;
}

interface Skill {
  id: string;
  code: string;
  name: string;
  strand: string;
  intro: string | null;
  description: string | null;
}

interface Subject {
  id: string;
  title: string;
  slug: string;
}

interface GamificationSummary {
  xp: number;
  tokens: number;
  streakDays: number;
  activeDaysThisWeek: number;
}

interface Props {
  subject: Subject;
  skill: Skill;
  items: Item[];
  userId: string;
  gamification: GamificationSummary;
  routeType: 'A' | 'B' | 'C';
  reteachPlan: ReteachPlan;
}

type Phase = 'intro' | 'reteach' | 'session' | 'results';

type QuestionType = 'ROUTINE' | 'FLUENCY' | 'RETRIEVAL' | 'TRANSFER' | 'APPLICATION' | 'MIXED' | 'DIAGNOSTIC';

interface NextQuestionRecommendation {
  questionType: QuestionType;
  supportLevel: 'INDEPENDENT' | 'LIGHT_PROMPT' | 'WORKED_EXAMPLE' | 'SCAFFOLDED' | 'FULL_EXPLANATION';
  isReviewItem: boolean;
  isTransferItem: boolean;
  isMixedItem: boolean;
  rationale: string;
}

interface DLEPayload {
  value: number;
  learningGain: number;
  knowledgeStability: number;
  instructionalTimeMs: number;
  durabilityBand: 'AT_RISK' | 'DEVELOPING' | 'DURABLE';
  version: 'v1';
}

interface ReteachRouteState {
  assignedPathId: string;
  reasonCodes: string[];
  difficultyStart: 'A' | 'B' | 'C';
}

const SHOW_DEBUG = process.env.NEXT_PUBLIC_SHOW_DEBUG === 'true';

function getMasteryTextColor(masteryPct: number) {
  if (masteryPct >= 80) return 'text-emerald-600';
  if (masteryPct >= 50) return 'text-amber-500';
  return 'text-rose-500';
}

function durabilityBadgeStyles(band: DLEPayload['durabilityBand'] | null) {
  if (band === 'DURABLE') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (band === 'DEVELOPING') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-rose-200 bg-rose-50 text-rose-700';
}

function itemMatchesRecommendation(item: Item, recommendation: NextQuestionRecommendation): boolean {
  const meta = parseItemOptions(item.options).meta;
  const transferCandidate = meta.questionRole === 'transfer' || meta.transferLevel === 'medium' || meta.transferLevel === 'high';

  switch (recommendation.questionType) {
    case 'TRANSFER':
      return transferCandidate;
    case 'MIXED':
      return transferCandidate || meta.questionRole === 'practice';
    case 'RETRIEVAL':
      return meta.questionRole === 'shadow' || meta.questionRole === 'anchor' || meta.questionRole === 'practice';
    case 'APPLICATION':
      return transferCandidate || meta.questionRole === 'misconception';
    case 'ROUTINE':
    case 'FLUENCY':
    default:
      return !transferCandidate;
  }
}

function pickNextIndex(
  items: Item[],
  answeredItemIds: Set<string>,
  recommendation: NextQuestionRecommendation | null
): number | null {
  const remaining = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !answeredItemIds.has(item.id));

  if (remaining.length === 0) return null;
  if (!recommendation) return remaining[0].index;

  const matched = remaining.find(({ item }) => itemMatchesRecommendation(item, recommendation));
  return (matched ?? remaining[0]).index;
}

export function LearnSession({ subject, skill, items, userId, gamification, routeType, reteachPlan }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [results, setResults] = useState<{ itemId: string; correct: boolean }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackFlash, setFeedbackFlash] = useState<'correct' | 'incorrect' | null>(null);
  const [nextRecommendation, setNextRecommendation] = useState<NextQuestionRecommendation | null>(null);
  const [latestDle, setLatestDle] = useState<DLEPayload | null>(null);
  const [routeState, setRouteState] = useState<ReteachRouteState | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const router = useRouter();

  const currentItem = items[currentIndex];
  const answerType = useMemo(
    () => parseAnswerType(currentItem?.type, currentItem?.question, currentItem?.options, currentItem?.answer),
    [currentItem?.type, currentItem?.question, currentItem?.options, currentItem?.answer]
  );
  const parsedOptions = useMemo(() => parseItemOptions(currentItem?.options), [currentItem?.options]);
  const options = parsedOptions.choices;
  const displayOptions = useMemo(
    () => options.map((o) => stripStudentQuestionLabel(o) || o),
    [options]
  );
  const questionText = useMemo(() => stripStudentQuestionLabel(currentItem?.question), [currentItem?.question]);

  useEffect(() => {
    if (!featureFlags.phase9ReteachV1 || routeState || routeLoading) return;
    let cancelled = false;

    async function createRoute() {
      setRouteLoading(true);
      try {
        const res = await fetch('/api/student/reteach/route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectId: subject.id,
            skillId: skill.id,
            routeType,
            checkpointAccuracy: 0.65,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as ReteachRouteState;
        if (!cancelled) setRouteState(data);
      } finally {
        if (!cancelled) setRouteLoading(false);
      }
    }

    createRoute();
    return () => {
      cancelled = true;
    };
  }, [routeLoading, routeState, routeType, skill.id, subject.id]);

  async function submitAnswer() {
    if (!selectedAnswer.trim() || !currentItem || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const answeredItemIds = new Set(results.map((r) => r.itemId));
      const remainingCount = items.filter((item) => !answeredItemIds.has(item.id)).length;

      const res = await fetch('/api/learn/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: currentItem.id,
          skillId: skill.id,
          subjectId: subject.id,
          answer: selectedAnswer,
          isLast: remainingCount <= 1,
          questionIndex: results.length,
          totalItems: items.length,
          routeType,
          previousResults: results,
          isTransferItem: parsedOptions.meta.questionRole === 'transfer' || parsedOptions.meta.transferLevel === 'medium' || parsedOptions.meta.transferLevel === 'high',
          isMixedItem: parsedOptions.meta.transferLevel === 'low' && parsedOptions.meta.questionRole === 'practice',
          questionType:
            parsedOptions.meta.questionRole === 'transfer'
              ? 'TRANSFER'
              : parsedOptions.meta.questionRole === 'shadow'
                ? 'RETRIEVAL'
                : 'ROUTINE',
          supportLevel: 'INDEPENDENT',
        }),
      });

      if (!res.ok) throw new Error('Could not save your answer. Please tap Next again.');

      const data = (await res.json()) as {
        correct?: boolean;
        hint?: string | null;
        nextQuestion?: NextQuestionRecommendation | null;
        dle?: DLEPayload | null;
      };
      if (typeof data.correct !== 'boolean') throw new Error('Invalid response from server');
      if (!data.correct && data.hint) setError(data.hint);

      const newResults = [...results, { itemId: currentItem.id, correct: data.correct }];
      setResults(newResults);
      setNextRecommendation(data.nextQuestion ?? null);
      setLatestDle(data.dle ?? null);
      setFeedbackFlash(data.correct ? 'correct' : 'incorrect');

      await new Promise((resolve) => setTimeout(resolve, data.correct ? 180 : 240));
      setFeedbackFlash(null);

      const answeredIdsAfterSubmit = new Set(newResults.map((r) => r.itemId));
      const nextIndex = pickNextIndex(items, answeredIdsAfterSubmit, data.nextQuestion ?? null);

      if (nextIndex !== null) {
        setCurrentIndex(nextIndex);
        setSelectedAnswer('');
      } else {
        setPhase('results');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === 'intro') {
    const hasItems = items.length > 0;
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4 sm:p-6">
        <div className="w-full max-w-xl space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="space-y-1">
            <p className="text-sm font-medium text-blue-600">{subject.title}</p>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{skill.name}</h1>
            {SHOW_DEBUG && (
              <p className="text-xs text-gray-400">
                {skill.code} · {skill.strand} · {userId}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 text-center text-xs sm:text-sm">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-slate-500">XP</p>
              <p className="font-semibold text-slate-900">{gamification.xp}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-slate-500">Streak</p>
              <p className="font-semibold text-slate-900">
                {gamification.streakDays} day{gamification.streakDays === 1 ? '' : 's'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-slate-500">Tokens</p>
              <p className="font-semibold text-slate-900">{gamification.tokens}</p>
            </div>
          </div>

          <p className="text-xs uppercase tracking-wide text-slate-500">Explanation route: {routeType}</p>

          {skill.intro && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm leading-6 text-gray-700">
              <p>{skill.intro}</p>
            </div>
          )}
          {skill.description && !skill.intro && <p className="text-sm leading-6 text-gray-600">{skill.description}</p>}

          {!hasItems && <p className="text-sm text-amber-700">No key questions are available for this skill yet.</p>}

          {featureFlags.phase9ReteachV1 && routeState && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-900">
              <p className="font-semibold">Why this next</p>
              <p className="mt-1">We’re strengthening this skill first so your independent answers stay stable.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              onClick={() => setPhase(featureFlags.phase9ReteachV1 ? 'reteach' : 'session')}
              disabled={!hasItems || (featureFlags.phase9ReteachV1 && routeLoading)}
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {featureFlags.phase9ReteachV1 ? 'Start skill-strengthening loop' : `Start key questions (${items.length})`}
            </button>
            {!featureFlags.phase9ReteachV1 && (
              <button
                onClick={() => setPhase('reteach')}
                disabled={!hasItems}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Guided reteach first
              </button>
            )}
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (phase === 'reteach') {
    return (
      <main className="anx-shell flex items-center justify-center">
        <div className="anx-panel w-full max-w-2xl p-7 sm:p-9">
          <ReteachSession
            subjectId={subject.id}
            skillId={skill.id}
            routeType={routeType}
            assignedPathId={routeState?.assignedPathId}
            plan={reteachPlan}
            onComplete={() => setPhase('session')}
          />
        </div>
      </main>
    );
  }

  if (phase === 'session' && currentItem) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4 sm:p-6">
        <div className="w-full max-w-xl space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-500">Question</p>
            <div className="flex items-center gap-3">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                AX {gamification.xp}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">
                🔥 {gamification.streakDays}
              </span>
              <span className="text-sm tabular-nums text-gray-400">
                {results.length + 1} / {items.length}
              </span>
            </div>
          </div>

          <div className="h-2 w-full rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${((results.length + 1) / items.length) * 100}%` }}
            />
          </div>

          {latestDle && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <span className={`rounded-full border px-2 py-1 font-semibold ${durabilityBadgeStyles(latestDle.durabilityBand)}`}>
                Durability: {latestDle.durabilityBand.replace('_', ' ')}
              </span>
              <span className="font-mono text-slate-600">DLE {latestDle.value.toFixed(2)}</span>
            </div>
          )}

          <div className={`rounded-2xl border-2 border-blue-100 bg-white px-5 py-6 sm:px-6 sm:py-7 ${feedbackFlash === 'correct' ? 'anx-pulse-correct' : ''} ${feedbackFlash === 'incorrect' ? 'anx-shake-incorrect' : ''}`}>
            <h2 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">{questionText}</h2>
          </div>

          <div className="space-y-3">
            {answerType === 'MCQ' ? (
              options.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  This question has no options yet.
                </p>
              ) : (
                options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedAnswer(option);
                      setError(null);
                    }}
                    className={`w-full rounded-xl border-2 px-4 py-4 text-left text-base font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                      selectedAnswer === option
                        ? 'border-blue-500 bg-blue-50 text-blue-800'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {displayOptions[i] ?? option}
                  </button>
                ))
              )
            ) : answerType === 'TRUE_FALSE' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setSelectedAnswer('true');
                      setError(null);
                    }}
                    className={`w-full rounded-xl border-2 px-4 py-3 text-base font-semibold transition-all ${
                      selectedAnswer === 'true'
                        ? 'border-blue-500 bg-blue-50 text-blue-800'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    True
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAnswer('false');
                      setError(null);
                    }}
                    className={`w-full rounded-xl border-2 px-4 py-3 text-base font-semibold transition-all ${
                      selectedAnswer === 'false'
                        ? 'border-blue-500 bg-blue-50 text-blue-800'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    False
                  </button>
                </div>
                <p className="text-xs text-slate-600">Tap True or False.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={selectedAnswer}
                  onChange={(e) => {
                    setSelectedAnswer(e.target.value);
                    setError(null);
                  }}
                  placeholder={answerType === 'SHORT_NUMERIC' ? 'Enter a number' : 'Type your answer'}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
                {answerType === 'SHORT_TEXT' && (
                  <p className="text-xs text-slate-600">Use clear words. Commas and “and” are both okay.</p>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {feedbackFlash === 'correct' && <p className="text-sm font-semibold text-emerald-600">+AX</p>}
          {feedbackFlash === 'incorrect' && <p className="text-sm text-amber-600">Good try — keep going.</p>}
          {SHOW_DEBUG && nextRecommendation && (
            <p className="text-xs text-slate-500">
              Next policy: {nextRecommendation.questionType} · {nextRecommendation.supportLevel} — {nextRecommendation.rationale}
            </p>
          )}

          <button
            onClick={submitAnswer}
            disabled={!selectedAnswer.trim() || submitting || (answerType === 'MCQ' && options.length === 0)}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {submitting ? 'Saving…' : results.length + 1 < items.length ? 'Next question' : 'Finish session'}
          </button>
        </div>
      </main>
    );
  }

  if (phase === 'results') {
    const correctCount = results.filter((r) => r.correct).length;
    const masteryPct = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;
    const estimatedXp = results.reduce((sum, r) => sum + (r.correct ? 5 : 2), 0) + 20;

    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4 sm:p-6">
        <div className="w-full max-w-xl space-y-6 rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Session Complete</h1>
            <p className="text-sm text-gray-500">Nice work — here’s how you did.</p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 py-5">
            <span className={`text-5xl font-bold tabular-nums ${getMasteryTextColor(masteryPct)}`}>{masteryPct}%</span>
            <p className="mt-2 text-sm text-gray-600">
              {correctCount} out of {results.length} correct
            </p>
            <p className="mt-1 text-xs text-slate-500">Estimated XP earned this route: +{estimatedXp}</p>
            {latestDle && (
              <p className="mt-1 text-xs text-slate-600">
                Latest DLE: <span className="font-mono">{latestDle.value.toFixed(2)}</span> · {latestDle.durabilityBand.replace('_', ' ')}
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-3">
            {results.map((r, i) => (
              <div key={`${r.itemId}-${i}`} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${
                    r.correct ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                >
                  {r.correct ? '✓' : '✗'}
                </span>
                <span className="text-gray-600">Question {i + 1}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            {masteryPct < 70 && (
              <button
                onClick={() => {
                  setCurrentIndex(0);
                  setSelectedAnswer('');
                  setResults([]);
                  setNextRecommendation(null);
                  setLatestDle(null);
                  setPhase('reteach');
                }}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Do guided reteach
              </button>
            )}
            <button
              onClick={() => {
                setCurrentIndex(0);
                setSelectedAnswer('');
                setResults([]);
                setError(null);
                setFeedbackFlash(null);
                setNextRecommendation(null);
                setLatestDle(null);
                setPhase('session');
              }}
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Practice Again
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  return null;
}
