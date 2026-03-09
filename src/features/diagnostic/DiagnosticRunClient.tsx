'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseAnswerType, parseItemOptions, stripStudentQuestionLabel } from '@/features/items/itemMeta';

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
  const [feedbackFlash, setFeedbackFlash] = useState<'correct' | 'incorrect' | null>(null);
  const router = useRouter();
  const answerType = useMemo(
    () => parseAnswerType(item.type, item.question, item.options, item.answer),
    [item.type, item.question, item.options, item.answer]
  );
  const parsedOptions = useMemo(() => parseItemOptions(item.options), [item.options]);
  const questionText = useMemo(() => stripStudentQuestionLabel(item.question), [item.question]);

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

      if (!res.ok) throw new Error('Could not save your answer. Tap Next again.');

      const data = (await res.json()) as { correct?: boolean; hint?: string | null };
      const wasCorrect = data.correct === true;
      if (!wasCorrect && data.hint) setError(data.hint);
      setFeedbackFlash(wasCorrect ? 'correct' : 'incorrect');
      await new Promise((resolve) => setTimeout(resolve, wasCorrect ? 180 : 240));
      setFeedbackFlash(null);

      router.refresh();
      router.push(`/diagnostic/${subjectSlug}/run`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your answer. Tap Next again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="anx-shell flex items-center justify-center">
      <div className="anx-panel w-full max-w-2xl space-y-6 p-7 sm:p-8">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Diagnostic question</p>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">AX live</span>
            <span className="text-sm text-slate-500">
              {itemsSeen + 1} / {maxItems}
            </span>
          </div>
        </div>

        <div className="anx-progress-track">
          <div className="anx-progress-bar" style={{ width: `${((itemsSeen + 1) / maxItems) * 100}%` }} />
        </div>

        <div className={`rounded-2xl border-2 border-blue-100 bg-white px-5 py-6 sm:px-6 sm:py-7 ${feedbackFlash === 'correct' ? 'anx-pulse-correct' : ''} ${feedbackFlash === 'incorrect' ? 'anx-shake-incorrect' : ''}`}>
          <h2 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">{questionText}</h2>
        </div>

        <div className="space-y-3">
          {answerType === 'MCQ' ? (
            parsedOptions.choices.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                This question has no options yet.
              </p>
            ) : (
              parsedOptions.choices.map((option, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedAnswer(option);
                    setError(null);
                  }}
                  className={`anx-option py-4 text-base font-semibold transition-transform active:scale-[0.99] ${selectedAnswer === option ? 'anx-option-selected' : ''}`}
                >
                  {option}
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
                  className={`anx-option py-3 text-base font-semibold ${selectedAnswer === 'true' ? 'anx-option-selected' : ''}`}
                >
                  True
                </button>
                <button
                  onClick={() => {
                    setSelectedAnswer('false');
                    setError(null);
                  }}
                  className={`anx-option py-3 text-base font-semibold ${selectedAnswer === 'false' ? 'anx-option-selected' : ''}`}
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
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
              />
              {answerType === 'SHORT_TEXT' && <p className="text-xs text-slate-600">Use clear words. Commas and “and” are both okay.</p>}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-rose-600">{error}</p>}
        {feedbackFlash === 'correct' && <p className="text-sm font-semibold text-emerald-600">+AX</p>}
        {feedbackFlash === 'incorrect' && <p className="text-sm text-amber-600">Good try — keep going.</p>}

        <button
          onClick={submitAnswer}
          disabled={!selectedAnswer.trim() || submitting || (answerType === 'MCQ' && parsedOptions.choices.length === 0)}
          className="anx-btn-primary w-full"
        >
          {submitting ? 'Saving…' : 'Next question'}
        </button>
      </div>
    </main>
  );
}
