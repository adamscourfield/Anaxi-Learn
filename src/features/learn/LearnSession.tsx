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
            className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 text-gray-700 focus:border-blue-500 focus:outline-none"
            placeholder={type === 'SHORT_NUMERIC' ? 'Enter a number' : 'Type your answer'}
          />
          {type === 'SHORT_TEXT' && (
            <p className="text-sm text-gray-500">Use clear words. Commas and “and” are both okay.</p>
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
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This question has no options yet.
          </p>
        ) : (
          options.map((option, i) => (
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
          {sanitizeStudentCopy(skill.intro) && (
            <div className="prose prose-sm text-gray-600">
              <p>{sanitizeStudentCopy(skill.intro)}</p>
            </div>
          )}
          {sanitizeStudentCopy(skill.description) && !sanitizeStudentCopy(skill.intro) && (
            <p className="text-gray-600">{sanitizeStudentCopy(skill.description)}</p>
          )}
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <p className="font-medium">What happens next</p>
            <p className="mt-1">You will do a short set of {items.length} questions. After that, we will either keep practising this skill, bring it back later, or move you on when you are ready.</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setPhase('session')}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              Start next skill ({items.length} questions)
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
            <div>
              <p className="text-sm text-gray-500">One question at a time</p>
              <p className="text-xs text-gray-400">Each question is a fresh start.</p>
            </div>
            <div className="text-right">
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
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${((currentIndex + 1) / items.length) * 100}%` }}
            />
          </div>
          <ItemVisualPanel item={currentItem} primarySkillCode={skill.code} />
          <h2 className="text-lg font-semibold text-gray-900">{currentItem.question}</h2>
          {currentItemContent && (
            <p className="text-sm text-gray-500">
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
            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
          >
            {submitting ? 'Checking…' : currentIndex < items.length - 1 ? 'Check and continue' : 'Finish for now'}
          </button>
        </div>
      </main>
    );
  }

  if (phase === 'results') {
    const correctCount = results.filter((r) => r.correct).length;
    const masteryPct = Math.round((correctCount / results.length) * 100);
    const outcomeTone = masteryPct >= 80 ? 'green' : masteryPct >= 50 ? 'amber' : 'blue';

    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-xl border border-gray-200 p-8 space-y-6">
          <div className={`rounded-xl border px-5 py-4 ${outcomeTone === 'green' ? 'border-green-200 bg-green-50' : outcomeTone === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}>
            <p className={`text-sm font-semibold ${outcomeTone === 'green' ? 'text-green-700' : outcomeTone === 'amber' ? 'text-amber-700' : 'text-blue-700'}`}>
              Session complete
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Nice work — this set is finished.</h1>
            <p className="mt-2 text-sm text-gray-700">
              We have enough from this short session to choose the next step. You do not have to get everything right in one go.
            </p>
          </div>

          <div className="text-center py-1">
            <span className={`text-5xl font-bold ${masteryPct >= 80 ? 'text-green-600' : masteryPct >= 50 ? 'text-yellow-500' : 'text-blue-600'}`}>
              {masteryPct}%
            </span>
            <p className="text-gray-500 mt-2">
              {correctCount} out of {results.length} correct
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-900">What happens next</p>
            <p className="mt-2 text-sm text-gray-700">
              We will use this whole session to decide whether you should practise this skill again soon, come back to it later, or move on to the next skill when you are ready.
            </p>
            <p className="mt-2 text-sm text-gray-600">
              If this one still feels tricky, that is okay. The next session will stay short and focused.
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
              Keep going
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  return null;
}
