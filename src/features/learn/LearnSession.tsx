'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReteachSession } from './ReteachSession';
import type { ReteachPlan } from './reteachContent';
import { parseAnswerType, parseItemOptions } from '@/features/items/itemMeta';

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

const SHOW_DEBUG = process.env.NEXT_PUBLIC_SHOW_DEBUG === 'true';

function getMasteryTextColor(masteryPct: number) {
  if (masteryPct >= 80) return 'text-emerald-600';
  if (masteryPct >= 50) return 'text-amber-500';
  return 'text-rose-500';
}

export function LearnSession({ subject, skill, items, userId, gamification, routeType, reteachPlan }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [results, setResults] = useState<{ itemId: string; correct: boolean }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackFlash, setFeedbackFlash] = useState<'correct' | 'incorrect' | null>(null);
  const router = useRouter();

  const currentItem = items[currentIndex];
  const answerType = useMemo(() => parseAnswerType(currentItem?.type), [currentItem?.type]);
  const parsedOptions = useMemo(() => parseItemOptions(currentItem?.options), [currentItem?.options]);
  const options = parsedOptions.choices;

  async function submitAnswer() {
    if (!selectedAnswer.trim() || !currentItem || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/learn/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: currentItem.id,
          skillId: skill.id,
          subjectId: subject.id,
          answer: selectedAnswer,
          isLast: currentIndex === items.length - 1,
          questionIndex: currentIndex,
          totalItems: items.length,
          routeType,
          previousResults: results,
        }),
      });

      if (!res.ok) throw new Error('Could not save your answer. Please tap Next again.');

      const data = (await res.json()) as { correct?: boolean; hint?: string | null };
      if (typeof data.correct !== 'boolean') throw new Error('Invalid response from server');
      if (!data.correct && data.hint) setError(data.hint);

      const newResults = [...results, { itemId: currentItem.id, correct: data.correct }];
      setResults(newResults);
      setFeedbackFlash(data.correct ? 'correct' : 'incorrect');

      await new Promise((resolve) => setTimeout(resolve, data.correct ? 180 : 240));
      setFeedbackFlash(null);

      if (currentIndex < items.length - 1) {
        setCurrentIndex(currentIndex + 1);
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

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              onClick={() => setPhase('session')}
              disabled={!hasItems}
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Start key questions ({items.length})
            </button>
            <button
              onClick={() => setPhase('reteach')}
              disabled={!hasItems}
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Guided reteach first
            </button>
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
                {currentIndex + 1} / {items.length}
              </span>
            </div>
          </div>

          <div className="h-2 w-full rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}
            />
          </div>

          <div className={`rounded-2xl border-2 border-blue-100 bg-white px-5 py-6 sm:px-6 sm:py-7 ${feedbackFlash === 'correct' ? 'anx-pulse-correct' : ''} ${feedbackFlash === 'incorrect' ? 'anx-shake-incorrect' : ''}`}>
            <h2 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">{currentItem.question}</h2>
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
                    {option}
                  </button>
                ))
              )
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

          <button
            onClick={submitAnswer}
            disabled={!selectedAnswer.trim() || submitting || (answerType === 'MCQ' && options.length === 0)}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {submitting ? 'Saving…' : currentIndex < items.length - 1 ? 'Next question' : 'Finish session'}
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
          </div>

          <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-3">
            {results.map((r, i) => (
              <div key={r.itemId} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm">
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
                  setPhase('reteach');
                }}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-blue-300 px-4 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Do guided reteach
              </button>
            )}
            <button
              onClick={() => router.push(`/learn/${subject.slug}`)}
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
