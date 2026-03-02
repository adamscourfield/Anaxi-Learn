'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Item {
  id: string;
  question: string;
  options: unknown;
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

export function LearnSession({ subject, skill, items, userId }: Props) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [results, setResults] = useState<{ itemId: string; correct: boolean }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const currentItem = items[currentIndex];
  const options = currentItem ? (currentItem.options as string[]) : [];

  async function submitAnswer() {
    if (!selectedAnswer || !currentItem) return;
    setSubmitting(true);

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

    const data = await res.json();
    const newResults = [...results, { itemId: currentItem.id, correct: data.correct }];
    setResults(newResults);

    if (currentIndex < items.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer('');
    } else {
      setPhase('results');
    }
    setSubmitting(false);
  }

  if (phase === 'intro') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-xl border border-gray-200 p-8 space-y-6">
          <div>
            <p className="text-sm text-blue-600 font-medium mb-1">{subject.title}</p>
            <h1 className="text-2xl font-bold text-gray-900">{skill.name}</h1>
            {SHOW_DEBUG && (
              <p className="text-xs text-gray-400 mt-1">
                {skill.code} · {skill.strand}
              </p>
            )}
          </div>
          {skill.intro && (
            <div className="prose prose-sm text-gray-600">
              <p>{skill.intro}</p>
            </div>
          )}
          {skill.description && !skill.intro && (
            <p className="text-gray-600">{skill.description}</p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setPhase('session')}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              Start Session ({items.length} questions)
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-3 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
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
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-xl border border-gray-200 p-8 space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {skill.name}
              {SHOW_DEBUG && (
                <span className="ml-2 text-xs text-gray-400">[{skill.code}]</span>
              )}
            </p>
            <span className="text-sm text-gray-400">
              {currentIndex + 1} / {items.length}
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}
            />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">{currentItem.question}</h2>
          <div className="space-y-3">
            {options.map((option, i) => (
              <button
                key={i}
                onClick={() => setSelectedAnswer(option)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                  selectedAnswer === option
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <button
            onClick={submitAnswer}
            disabled={!selectedAnswer || submitting}
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
          >
            {submitting ? 'Submitting…' : currentIndex < items.length - 1 ? 'Next' : 'Finish'}
          </button>
        </div>
      </main>
    );
  }

  if (phase === 'results') {
    const correctCount = results.filter((r) => r.correct).length;
    const masteryPct = Math.round((correctCount / results.length) * 100);

    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-xl border border-gray-200 p-8 space-y-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Session Complete!</h1>
          <div className="py-4">
            <span className={`text-5xl font-bold ${masteryPct >= 80 ? 'text-green-600' : masteryPct >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
              {masteryPct}%
            </span>
            <p className="text-gray-500 mt-2">
              {correctCount} out of {results.length} correct
            </p>
          </div>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={r.itemId} className="flex items-center gap-3 text-sm">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${r.correct ? 'bg-green-500' : 'bg-red-400'}`}>
                  {r.correct ? '✓' : '✗'}
                </span>
                <span className="text-gray-600">Question {i + 1}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/learn/${subject.slug}`)}
              className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Practice Again
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
