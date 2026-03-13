'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OrderedMagnetInput } from '@/components/learn/OrderedMagnetInput';
import { ItemVisualPanel } from '@/components/learn/ItemVisualPanel';
import { getItemContent, ItemInteractionType } from './itemContent';
import { sanitizeStudentCopy } from './studentCopy';

interface Item {
  id: string;
  question: string;
  options: unknown;
  answer: string;
  type: string;
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
  const currentItemContent = currentItem ? getItemContent(currentItem) : null;
  const options = currentItemContent?.choices ?? [];

  function renderAnswerInput(type: ItemInteractionType) {
    if (type === 'SHORT_TEXT' || type === 'SHORT_NUMERIC') {
      return (
        <div className="space-y-2">
          <input
            value={selectedAnswer}
            onChange={(e) => setSelectedAnswer(e.target.value)}
            inputMode={type === 'SHORT_NUMERIC' ? 'decimal' : 'text'}
            className="anx-input py-3.5 text-base"
            placeholder={type === 'SHORT_NUMERIC' ? 'Enter a number' : 'Type your answer'}
          />
          {type === 'SHORT_TEXT' && (
            <p className="text-xs" style={{ color: 'var(--anx-text-muted)' }}>Use clear words. Commas and &quot;and&quot; are both okay.</p>
          )}
        </div>
      );
    }

    if (type === 'ORDER') {
      return (
        <OrderedMagnetInput
          choices={options}
          value={selectedAnswer}
          onChange={setSelectedAnswer}
          emptyPrompt="Drag the fridge magnets here in the right order."
          helperText="You can drag to reorder, or tap a magnet to add it."
        />
      );
    }

    return (
      <div className="space-y-3">
        {options.length === 0 ? (
          <p className="anx-alert anx-alert-warning">
            This question has no options yet.
          </p>
        ) : (
          options.map((option, i) => (
            <button
              key={i}
              onClick={() => setSelectedAnswer(option)}
              className={`anx-option text-base font-semibold ${selectedAnswer === option ? 'anx-option-selected' : ''}`}
            >
              {option}
            </button>
          ))
        )}
      </div>
    );
  }

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
      <main className="anx-shell flex items-center justify-center">
        <div className="anx-panel w-full max-w-lg space-y-6 p-8 sm:p-10">
          <div>
            <span className="anx-badge anx-badge-blue mb-3">{subject.title}</span>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--anx-text)' }}>{skill.name}</h1>
            {SHOW_DEBUG && (
              <p className="mt-1 text-xs" style={{ color: 'var(--anx-text-faint)' }}>
                {skill.code} &middot; {skill.strand}
              </p>
            )}
          </div>
          {sanitizeStudentCopy(skill.intro) && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--anx-text-muted)' }}>
              {sanitizeStudentCopy(skill.intro)}
            </p>
          )}
          {sanitizeStudentCopy(skill.description) && !sanitizeStudentCopy(skill.intro) && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--anx-text-muted)' }}>
              {sanitizeStudentCopy(skill.description)}
            </p>
          )}
          <div className="anx-divider" />
          <div className="flex gap-3">
            <button
              onClick={() => setPhase('session')}
              className="anx-btn-primary flex-1 py-3.5 text-base"
            >
              Start next skill ({items.length} questions)
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="anx-btn-secondary px-5 py-3.5"
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
      <main className="anx-shell flex items-center justify-center">
        <div className="anx-panel w-full max-w-lg space-y-6 p-7 sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: 'var(--anx-text-muted)' }}>One question at a time</p>
              <p className="text-xs" style={{ color: 'var(--anx-text-faint)' }}>Each question is a fresh start.</p>
            </div>
            <div className="text-right">
              <p className="text-sm" style={{ color: 'var(--anx-text-muted)' }}>
                {skill.name}
                {SHOW_DEBUG && (
                  <span className="ml-2 text-xs" style={{ color: 'var(--anx-text-faint)' }}>[{skill.code}]</span>
                )}
              </p>
              <span className="text-sm font-medium" style={{ color: 'var(--anx-text-faint)' }}>
                {currentIndex + 1} / {items.length}
              </span>
            </div>
          </div>
          <div className="anx-progress-track">
            <div
              className="anx-progress-bar"
              style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}
            />
          </div>
          <ItemVisualPanel item={currentItem} primarySkillCode={skill.code} />
          <div className="rounded-2xl border-2 px-5 py-6 sm:px-6 sm:py-7" style={{ borderColor: 'var(--anx-border-subtle)', background: 'var(--anx-surface-soft)' }}>
            <h2 className="text-xl font-bold leading-tight sm:text-2xl" style={{ color: 'var(--anx-text)' }}>{currentItem.question}</h2>
          </div>
          {currentItemContent && (
            <p className="text-sm" style={{ color: 'var(--anx-text-muted)' }}>
              {currentItemContent.type === 'SHORT_NUMERIC'
                ? 'Type your answer as a number.'
                : currentItemContent.type === 'SHORT_TEXT'
                  ? 'Type your answer clearly.'
                  : currentItemContent.type === 'ORDER'
                    ? 'Put the answers in the right order.'
                    : 'Choose one answer.'}
            </p>
          )}
          {currentItemContent && renderAnswerInput(currentItemContent.type)}
          <button
            onClick={submitAnswer}
            disabled={!selectedAnswer || submitting}
            className="anx-btn-primary w-full py-3.5 text-base"
          >
            {submitting ? 'Checking\u2026' : currentIndex < items.length - 1 ? 'Check and continue' : 'Finish for now'}
          </button>
        </div>
      </main>
    );
  }

  if (phase === 'results') {
    const correctCount = results.filter((r) => r.correct).length;
    const masteryPct = Math.round((correctCount / results.length) * 100);

    return (
      <main className="anx-shell flex items-center justify-center">
        <div className="anx-panel w-full max-w-lg space-y-6 p-8 sm:p-10 text-center">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--anx-text)' }}>Session complete</h1>
          <p className="text-sm" style={{ color: 'var(--anx-text-muted)' }}>You have finished this set. We will use this to choose what should happen next.</p>
          <div className="py-4">
            <span className={`text-5xl font-bold ${masteryPct >= 80 ? 'text-emerald-500' : masteryPct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
              {masteryPct}%
            </span>
            <p className="mt-2 text-sm" style={{ color: 'var(--anx-text-muted)' }}>
              {correctCount} out of {results.length} correct
            </p>
            <p className="mt-2 text-sm text-gray-500">One question does not decide everything. Your next step will be based on the whole session.</p>
          </div>
          <div className="anx-divider" />
          <div className="space-y-2 text-left">
            {results.map((r, i) => (
              <div key={r.itemId} className="flex items-center gap-3 text-sm">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: r.correct ? 'var(--anx-success)' : 'var(--anx-danger)' }}
                >
                  {r.correct ? '\u2713' : '\u2717'}
                </span>
                <span style={{ color: 'var(--anx-text-secondary)' }}>Question {i + 1}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/learn/${subject.slug}`)}
              className="anx-btn-secondary flex-1 py-3"
            >
              Try this skill again
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="anx-btn-primary flex-1 py-3"
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
