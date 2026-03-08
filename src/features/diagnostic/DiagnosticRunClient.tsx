'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseAnswerType, parseItemOptions } from '@/features/items/itemMeta';

interface Props {
  subject: { id: string; title: string; slug: string };
  skill: { id: string; code: string; name: string; strand: string };
  item: { id: string; question: string; options: unknown; type?: string };
  sessionId: string;
  itemsSeen: number;
  maxItems: number;
  subjectSlug: string;
}

export function DiagnosticRunClient({ subject, skill, item, sessionId, itemsSeen, maxItems, subjectSlug }: Props) {
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const answerType = useMemo(() => parseAnswerType(item.type), [item.type]);
  const parsedOptions = useMemo(() => parseItemOptions(item.options), [item.options]);

  async function submitAnswer() {
    if (!selectedAnswer.trim() || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/diagnostic/${subjectSlug}/submit`, {
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

      if (!res.ok) throw new Error(`Submit failed (${res.status})`);

      router.refresh();
      router.push(`/diagnostic/${subjectSlug}/run`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="anx-shell flex items-center justify-center">
      <div className="anx-panel w-full max-w-2xl space-y-6 p-7 sm:p-8">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Diagnostic question</p>
          <span className="text-sm text-slate-500">
            {itemsSeen + 1} / {maxItems}
          </span>
        </div>

        <div className="anx-progress-track">
          <div className="anx-progress-bar" style={{ width: `${((itemsSeen + 1) / maxItems) * 100}%` }} />
        </div>

        <div className="rounded-2xl border-2 border-blue-100 bg-white px-5 py-6 sm:px-6 sm:py-7">
          <h2 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">{item.question}</h2>
        </div>

        <div className="space-y-3">
          {answerType === 'MCQ' ? (
            parsedOptions.choices.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                This diagnostic item has no valid options.
              </p>
            ) : (
              parsedOptions.choices.map((option, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedAnswer(option);
                    setError(null);
                  }}
                  className={`anx-option py-4 text-base font-semibold ${selectedAnswer === option ? 'anx-option-selected' : ''}`}
                >
                  {option}
                </button>
              ))
            )
          ) : (
            <input
              type="text"
              value={selectedAnswer}
              onChange={(e) => {
                setSelectedAnswer(e.target.value);
                setError(null);
              }}
              placeholder={answerType === 'SHORT_NUMERIC' ? 'Enter a number' : 'Type your answer'}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
            />
          )}
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <button
          onClick={submitAnswer}
          disabled={!selectedAnswer.trim() || submitting || (answerType === 'MCQ' && parsedOptions.choices.length === 0)}
          className="anx-btn-primary w-full"
        >
          {submitting ? 'Submitting…' : 'Next'}
        </button>
      </div>
    </main>
  );
}
