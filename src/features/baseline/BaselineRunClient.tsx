'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseAnswerType, parseItemOptions, stripStudentQuestionLabel } from '@/features/items/itemMeta';

type BaselineItem = {
  id: string;
  question: string;
  type?: string;
  options: unknown;
  answer?: string;
  skillId: string;
  skillCode: string;
};

export function BaselineRunClient({ subjectSlug }: { subjectSlug: string }) {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [item, setItem] = useState<BaselineItem | null>(null);
  const [itemsSeen, setItemsSeen] = useState(0);
  const [maxItems, setMaxItems] = useState(24);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const answerType = useMemo(
    () => parseAnswerType(item?.type, item?.question, item?.options, item?.answer),
    [item?.type, item?.question, item?.options, item?.answer]
  );
  const parsedOptions = useMemo(() => parseItemOptions(item?.options ?? {}), [item?.options]);
  const questionText = useMemo(() => stripStudentQuestionLabel(item?.question), [item?.question]);

  const loadNext = useCallback(async (currentSessionId: string) => {
    const nextRes = await fetch('/api/baseline/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: currentSessionId }),
    });
    if (!nextRes.ok) throw new Error('Could not load the next question.');
    const next = (await nextRes.json()) as {
      done: boolean;
      reason?: string;
      item?: BaselineItem;
      itemsSeen: number;
      maxItems?: number;
    };

    setItemsSeen(next.itemsSeen ?? 0);
    if (next.maxItems) setMaxItems(next.maxItems);

    if (next.done || !next.item) {
      await fetch('/api/baseline/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId, subjectSlug }),
      });
      router.push(`/learn/${subjectSlug}`);
      return;
    }

    setItem(next.item);
    setSelectedAnswer('');
  }, [router, subjectSlug]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        const startRes = await fetch('/api/baseline/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectSlug }),
        });
        if (!startRes.ok) throw new Error('Could not start baseline.');
        const start = (await startRes.json()) as { sessionId: string; maxItems?: number };

        if (cancelled) return;
        setSessionId(start.sessionId);
        if (start.maxItems) setMaxItems(start.maxItems);
        await loadNext(start.sessionId);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not start baseline.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [loadNext, subjectSlug]);

  async function submit() {
    if (!sessionId || !item || !selectedAnswer.trim() || submitting) return;
    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch('/api/baseline/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          itemId: item.id,
          skillId: item.skillId,
          answer: selectedAnswer,
        }),
      });
      if (!res.ok) throw new Error('Could not save your answer. Try again.');
      await loadNext(sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your answer. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8 text-sm text-slate-600">Getting your questions ready…</div>;
  if (error) return <div className="p-8 text-sm text-rose-600">{error}</div>;
  if (!item) return <div className="p-8 text-sm text-slate-600">Loading your next question…</div>;

  return (
    <main className="anx-shell flex items-center justify-center">
      <div className="anx-panel w-full max-w-2xl space-y-6 p-7 sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700">Let&apos;s start with a few quick questions</p>
            <p className="text-xs text-slate-500">One question at a time. Just have a go.</p>
          </div>
          <span className="text-sm text-slate-500">{Math.min(itemsSeen + 1, maxItems)} / {maxItems}</span>
        </div>

        <div className="anx-progress-track">
          <div className="anx-progress-bar" style={{ width: `${(Math.min(itemsSeen + 1, maxItems) / maxItems) * 100}%` }} />
        </div>

        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-5 py-4 text-sm text-slate-700 sm:px-6">
          <p className="font-semibold text-slate-900">What to do</p>
          <p className="mt-1">
            {answerType === 'MCQ'
              ? 'Pick one answer.'
              : answerType === 'TRUE_FALSE'
                ? 'Pick true or false.'
                : answerType === 'SHORT_NUMERIC'
                  ? 'Type your answer as a number.'
                  : 'Type your answer clearly.'}
          </p>
        </div>

        <div className="rounded-2xl border-2 border-blue-100 bg-white px-5 py-6 sm:px-6 sm:py-7">
          <h2 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">{questionText}</h2>
        </div>

        <div className="space-y-3">
          {answerType === 'MCQ' ? (
            parsedOptions.choices.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                This question is still being set up.
              </p>
            ) : (
              parsedOptions.choices.map((option, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedAnswer(option)}
                  className={`anx-option py-4 text-base font-semibold ${selectedAnswer === option ? 'anx-option-selected' : ''}`}
                >
                  {option}
                </button>
              ))
            )
          ) : answerType === 'TRUE_FALSE' ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedAnswer('true')}
                  className={`anx-option py-3 text-base font-semibold ${selectedAnswer === 'true' ? 'anx-option-selected' : ''}`}
                >
                  True
                </button>
                <button
                  onClick={() => setSelectedAnswer('false')}
                  className={`anx-option py-3 text-base font-semibold ${selectedAnswer === 'false' ? 'anx-option-selected' : ''}`}
                >
                  False
                </button>
              </div>
              <p className="text-xs text-slate-600">Tap true or false.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={selectedAnswer}
                onChange={(e) => setSelectedAnswer(e.target.value)}
                placeholder={answerType === 'SHORT_NUMERIC' ? 'Type a number' : 'Type your answer'}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
              />
              {answerType === 'SHORT_TEXT' && <p className="text-xs text-slate-600">Use clear words. Commas and “and” are both okay.</p>}
            </div>
          )}
        </div>

        <button
          onClick={submit}
          disabled={!selectedAnswer.trim() || submitting || (answerType === 'MCQ' && parsedOptions.choices.length === 0)}
          className="anx-btn-primary w-full"
        >
          {submitting ? 'Saving…' : 'Check and go on'}
        </button>
      </div>
    </main>
  );
}
