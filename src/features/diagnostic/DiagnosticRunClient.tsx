'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getItemContent, ItemInteractionType } from '@/features/learn/itemContent';

interface Props {
  subject: { id: string; title: string; slug: string };
  skill: { id: string; code: string; name: string; strand: string };
  item: { id: string; question: string; options: unknown; answer: string; type: string };
  sessionId: string;
  itemsSeen: number;
  maxItems: number;
  subjectSlug: string;
}

export function DiagnosticRunClient({ subject, skill, item, sessionId, itemsSeen, maxItems, subjectSlug }: Props) {
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const itemContent = getItemContent(item);

  function toggleOrderedChoice(choice: string) {
    const currentOrder = selectedAnswer ? selectedAnswer.split(' | ') : [];
    if (currentOrder.includes(choice)) {
      setSelectedAnswer(currentOrder.filter((entry) => entry !== choice).join(' | '));
      return;
    }

    setSelectedAnswer([...currentOrder, choice].join(' | '));
  }

  function renderAnswerInput(type: ItemInteractionType) {
    if (type === 'SHORT_TEXT') {
      return (
        <input
          value={selectedAnswer}
          onChange={(e) => setSelectedAnswer(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 text-gray-700 focus:border-blue-500 focus:outline-none"
          placeholder="Type your answer"
        />
      );
    }

    if (type === 'ORDER') {
      const currentOrder = selectedAnswer ? selectedAnswer.split(' | ') : [];
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 min-h-12 rounded-lg border border-dashed border-blue-200 bg-blue-50/60 p-3">
            {currentOrder.length > 0 ? (
              currentOrder.map((choice) => (
                <button
                  key={choice}
                  onClick={() => toggleOrderedChoice(choice)}
                  className="rounded-full bg-blue-600 px-3 py-1 text-sm font-medium text-white"
                >
                  {choice}
                </button>
              ))
            ) : (
              <span className="text-sm text-blue-700">Tap the choices below in the correct order.</span>
            )}
          </div>
          <div className="space-y-3">
            {itemContent.choices.map((option, i) => {
              const isSelected = currentOrder.includes(option);
              return (
                <button
                  key={i}
                  onClick={() => toggleOrderedChoice(option)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {itemContent.choices.map((option, i) => (
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
    );
  }

  async function submitAnswer() {
    if (!selectedAnswer || submitting) return;
    setSubmitting(true);

    await fetch(`/api/diagnostic/${subjectSlug}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        itemId: item.id,
        skillId: skill.id,
        subjectId: subject.id,
        skillCode: skill.code,
        strand: skill.strand,
        answer: selectedAnswer,
      }),
    });

    // Refresh to get next item (server will decide to continue or complete)
    router.refresh();
    router.push(`/diagnostic/${subjectSlug}/run`);
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-xl border border-gray-200 p-8 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Diagnostic · <span className="font-medium">{skill.strand}</span>
          </p>
          <span className="text-sm text-gray-400">
            {itemsSeen + 1} / {maxItems} max
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${((itemsSeen + 1) / maxItems) * 100}%` }}
          />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{item.question}</h2>
        {renderAnswerInput(itemContent.type)}
        <button
          onClick={submitAnswer}
          disabled={!selectedAnswer || submitting}
          className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
        >
          {submitting ? 'Submitting…' : 'Next'}
        </button>
      </div>
    </main>
  );
}
