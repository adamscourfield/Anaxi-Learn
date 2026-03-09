'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseAnswerType, parseItemOptions } from '@/features/items/itemMeta';

type BaselineItem = {
  id: string;
  question: string;
  type?: string;
  options: unknown;
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
    () => parseAnswerType(item?.type, item?.question, item?.options),
    [item?.type, item?.question, item?.options]
  );
  const parsedOptions = useMemo(() => parseItemOptions(item?.options ?? {}), [item?.options]);

  async function loadNext(currentSessionId: string) {
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
  }

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
  }, [router, subjectSlug]);

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
      if (!res.ok) throw new Error('Could not save your answer. Tap Next again.');
      await loadNext(sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your answer. Tap Next again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-8 text-sm text-slate-600">Getting your baseline ready…</div>;
  if (error) return <div className="p-8 text-sm text-rose-600">{error}</div>;
  if (!item) return <div className="p-8 text-sm text-slate-600">Loading your next question…</div>;

  return (
    <main className="anx-shell flex items-center justify-center">
      <div className="anx-panel w-full max-w-2xl space-y-6 p-7 sm:p-8">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Baseline onboarding</p>
          <span className="text-sm text-slate-500">{Math.min(itemsSeen + 1, maxItems)} / {maxItems}</span>
        </div>

        <div className="anx-progress-track">
          <div className="anx-progress-bar" style={{ width: `${(Math.min(itemsSeen + 1, maxItems) / maxItems) * 100}%` }} />
        </div>

        <div className="rounded-2xl border-2 border-blue-100 bg-white px-5 py-6 sm:px-6 sm:py-7">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-700">{item.skillCode}</p>
          <h2 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">{item.question}</h2>
        </div>

        <div className="space-y-3">
          {answerType === 'MCQ' ? (
            parsedOptions.choices.map((option, i) => (
              <button
                key={i}
                onClick={() => setSelectedAnswer(option)}
                className={`anx-option py-4 text-base font-semibold ${selectedAnswer === option ? 'anx-option-selected' : ''}`}
              >
                {option}
              </button>
            ))
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
              <p className="text-xs text-slate-600">Tap True or False.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={selectedAnswer}
                onChange={(e) => setSelectedAnswer(e.target.value)}
                placeholder={answerType === 'SHORT_NUMERIC' ? 'Enter a number' : 'Type your answer'}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
              />
              {answerType === 'SHORT_TEXT' && <p className="text-xs text-slate-600">Use clear words. Commas and “and” are both okay.</p>}
            </div>
          )}
        </div>

        <button
          onClick={submit}
          disabled={!selectedAnswer.trim() || submitting}
          className="anx-btn-primary w-full"
        >
          {submitting ? 'Saving…' : 'Next question'}
        </button>
      </div>
    </main>
  );
}
