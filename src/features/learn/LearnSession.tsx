'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReteachSession } from './ReteachSession';
import type { ReteachPlan } from './reteachContent';

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

export function LearnSession({ subject, skill, items, userId, gamification, routeType, reteachPlan }: Props) {
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
        questionIndex: currentIndex,
        totalItems: items.length,
        routeType,
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
      <main className="anx-shell flex items-center justify-center">
        <div className="anx-panel w-full max-w-2xl space-y-6 p-7 sm:p-8">
          <div>
            <p className="mb-1 text-sm font-semibold text-indigo-600">{subject.title}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{skill.name}</h1>
            {SHOW_DEBUG && (
              <p className="mt-1 text-xs text-slate-500">
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
              <p className="font-semibold text-slate-900">{gamification.streakDays} day{gamification.streakDays === 1 ? '' : 's'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-slate-500">Tokens</p>
              <p className="font-semibold text-slate-900">{gamification.tokens}</p>
            </div>
          </div>

          <p className="text-xs uppercase tracking-wide text-slate-500">Explanation route: {routeType}</p>
          {skill.intro && <p className="text-sm leading-relaxed text-slate-600">{skill.intro}</p>}
          {skill.description && !skill.intro && <p className="text-sm leading-relaxed text-slate-600">{skill.description}</p>}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button onClick={() => setPhase('reteach')} className="anx-btn-primary flex-1">
              Start guided reteach ({items.length} key questions follow)
            </button>
            <button onClick={() => router.push('/dashboard')} className="anx-btn-secondary">
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
      <main className="anx-shell flex items-center justify-center">
        <div className="anx-panel w-full max-w-2xl space-y-6 p-7 sm:p-8">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {skill.name}
              {SHOW_DEBUG && <span className="ml-2 text-xs text-slate-400">[{skill.code}]</span>}
            </p>
            <span className="text-sm text-slate-500">
              {currentIndex + 1} / {items.length}
            </span>
          </div>

          <div className="anx-progress-track">
            <div className="anx-progress-bar" style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }} />
          </div>

          <h2 className="text-xl font-semibold leading-snug text-slate-900">{currentItem.question}</h2>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p>
              Correct so far: <span className="font-semibold">{results.filter((r) => r.correct).length}</span> / {results.length}
            </p>
            <p className="text-xs text-slate-500 mt-1">Skill trajectory: Not Yet → Developing → Secure</p>
          </div>

          <div className="space-y-3">
            {options.map((option, i) => (
              <button
                key={i}
                onClick={() => setSelectedAnswer(option)}
                className={`anx-option ${selectedAnswer === option ? 'anx-option-selected' : ''}`}
              >
                {option}
              </button>
            ))}
          </div>

          <button onClick={submitAnswer} disabled={!selectedAnswer || submitting} className="anx-btn-primary w-full">
            {submitting ? 'Submitting…' : currentIndex < items.length - 1 ? 'Next' : 'Finish'}
          </button>
        </div>
      </main>
    );
  }

  if (phase === 'results') {
    const correctCount = results.filter((r) => r.correct).length;
    const masteryPct = Math.round((correctCount / results.length) * 100);
    const estimatedXp = results.reduce((sum, r) => sum + (r.correct ? 5 : 2), 0) + 20;

    return (
      <main className="anx-shell flex items-center justify-center">
        <div className="anx-panel anx-route-complete w-full max-w-2xl space-y-6 p-7 text-center sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Session Complete</h1>

          <div className="anx-status-glow rounded-xl border border-slate-200 bg-slate-50/80 py-5">
            <span className={`text-5xl font-semibold ${masteryPct >= 80 ? 'text-emerald-600' : masteryPct >= 50 ? 'text-amber-600' : 'text-rose-500'}`}>
              {masteryPct}%
            </span>
            <p className="mt-2 text-sm text-slate-600">
              {correctCount} out of {results.length} correct
            </p>
            <p className="mt-1 text-xs text-slate-500">Estimated XP earned this route: +{estimatedXp}</p>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-left">
            {results.map((r, i) => (
              <div key={r.itemId} className="flex items-center gap-3 text-sm">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold text-white ${
                    r.correct ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}
                >
                  {r.correct ? '✓' : '✗'}
                </span>
                <span className="text-slate-700">Question {i + 1}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button onClick={() => router.push(`/learn/${subject.slug}`)} className="anx-btn-secondary flex-1">
              Practice Again
            </button>
            <button onClick={() => router.push('/dashboard')} className="anx-btn-primary flex-1">
              Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  return null;
}
