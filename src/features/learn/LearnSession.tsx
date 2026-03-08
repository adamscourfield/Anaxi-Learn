'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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

interface Props {
  subject: Subject;
  skill: Skill;
  items: Item[];
  userId: string;
}

type Phase = 'intro' | 'session' | 'results';

const SHOW_DEBUG = process.env.NEXT_PUBLIC_SHOW_DEBUG === 'true';

function getMasteryTextColor(masteryPct: number) {
  if (masteryPct >= 80) return 'text-emerald-600';
  if (masteryPct >= 50) return 'text-amber-500';
  return 'text-rose-500';
}


export function LearnSession({ subject, skill, items, userId }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [results, setResults] = useState<{ itemId: string; correct: boolean }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const currentItem = items[currentIndex];
  const answerType = useMemo(() => parseAnswerType(currentItem?.type), [currentItem?.type]);
  const parsedOptions = useMemo(() => parseItemOptions(currentItem?.options), [currentItem?.options]);
  const options = parsedOptions.choices;

  async function submitAnswer() {
    if (!selectedAnswer || !currentItem || submitting) return;
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
          totalItems: items.length,
          previousResults: results,
        }),
      });

      if (!res.ok) {
        throw new Error(`Attempt submission failed (${res.status})`);
      }

      const data = (await res.json()) as { correct?: boolean };
      if (typeof data.correct !== 'boolean') {
        throw new Error('Invalid response from server');
      }

      const newResults = [...results, { itemId: currentItem.id, correct: data.correct }];
      setResults(newResults);

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
          {skill.intro && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm leading-6 text-gray-700">
              <p>{skill.intro}</p>
            </div>
          )}
          {skill.description && !skill.intro && <p className="text-sm leading-6 text-gray-600">{skill.description}</p>}

          {!hasItems && <p className="text-sm text-amber-700">No questions are available for this skill yet.</p>}

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              onClick={() => setPhase('session')}
              disabled={!hasItems}
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              Start Session ({items.length} questions)
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

  if (phase === 'session' && currentItem) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4 sm:p-6">
        <div className="w-full max-w-xl space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-600">
              {skill.name}
              {SHOW_DEBUG && <span className="ml-2 text-xs text-gray-400">[{skill.code}]</span>}
            </p>
            <span className="text-sm tabular-nums text-gray-400">
              {currentIndex + 1} / {items.length}
            </span>
          </div>

          {(parsedOptions.meta.route || parsedOptions.meta.questionRole !== 'practice') && (
            <p className="text-xs text-blue-700">
              {parsedOptions.meta.route ? `Route ${parsedOptions.meta.route}` : 'Guided practice'}
              {' · '}
              {parsedOptions.meta.questionRole.replace('_', ' ')}
            </p>
          )}

          <div className="h-2 w-full rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}
            />
          </div>

          <h2 className="text-xl font-semibold leading-snug text-gray-900">{currentItem.question}</h2>

          <div className="space-y-3">
            {answerType === 'MCQ' ? (
              options.length === 0 ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  This question has no valid options. Please go back and try again.
                </p>
              ) : (
                options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedAnswer(option);
                      setError(null);
                    }}
                    className={`w-full rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
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
              <input
                type={answerType === 'SHORT_NUMERIC' ? 'text' : 'text'}
                value={selectedAnswer}
                onChange={(e) => {
                  setSelectedAnswer(e.target.value);
                  setError(null);
                }}
                placeholder={answerType === 'SHORT_NUMERIC' ? 'Enter a number' : 'Type your answer'}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-gray-800 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <button
            onClick={submitAnswer}
            disabled={!selectedAnswer.trim() || submitting || (answerType === 'MCQ' && options.length === 0)}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {submitting ? 'Submitting…' : currentIndex < items.length - 1 ? 'Next' : 'Finish'}
          </button>
        </div>
      </main>
    );
  }

  if (phase === 'results') {
    const correctCount = results.filter((r) => r.correct).length;
    const masteryPct = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;

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
          </div>

          <div className="space-y-2 rounded-xl border border-gray-100 bg-white p-3">
            {results.map((r, i) => (
              <div key={r.itemId} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${r.correct ? 'bg-emerald-500' : 'bg-rose-500'}`}
                >
                  {r.correct ? '✓' : '✗'}
                </span>
                <span className="text-gray-600">Question {i + 1}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
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
