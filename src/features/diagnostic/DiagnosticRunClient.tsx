'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OrderedMagnetInput } from '@/components/learn/OrderedMagnetInput';
import { ItemVisualPanel } from '@/components/learn/ItemVisualPanel';
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

  function renderAnswerInput(type: ItemInteractionType) {
    if (type === 'SHORT_TEXT' || type === 'SHORT_NUMERIC') {
      return (
        <input
          value={selectedAnswer}
          onChange={(e) => setSelectedAnswer(e.target.value)}
          inputMode={type === 'SHORT_NUMERIC' ? 'decimal' : 'text'}
          className="anx-input py-3.5 text-base"
          placeholder={type === 'SHORT_NUMERIC' ? 'Enter a number' : 'Type your answer'}
        />
      );
    }

    if (type === 'ORDER') {
      return (
        <OrderedMagnetInput
          choices={itemContent.choices}
          value={selectedAnswer}
          onChange={setSelectedAnswer}
          emptyPrompt="Drag the fridge magnets here in the right order."
          helperText="You can drag to reorder, or tap a magnet to add it."
        />
      );
    }

    return (
      <div className="space-y-3">
        {itemContent.choices.map((option, i) => (
          <button
            key={i}
            onClick={() => setSelectedAnswer(option)}
            className={`anx-option text-base font-semibold ${selectedAnswer === option ? 'anx-option-selected' : ''}`}
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
    <main className="anx-shell flex items-center justify-center">
      <div className="anx-panel w-full max-w-lg space-y-6 p-7 sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm" style={{ color: 'var(--anx-text-muted)' }}>One question at a time</p>
            <p className="text-xs" style={{ color: 'var(--anx-text-faint)' }}>Just try your best — this helps us choose the right starting point.</p>
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--anx-text-faint)' }}>
            {itemsSeen + 1} / {maxItems} max
          </span>
        </div>
        <div className="anx-progress-track">
          <div
            className="anx-progress-bar"
            style={{ width: `${((itemsSeen + 1) / maxItems) * 100}%` }}
          />
        </div>
        <ItemVisualPanel item={item} primarySkillCode={skill.code} />
        <div className="rounded-2xl border-2 px-5 py-6 sm:px-6 sm:py-7" style={{ borderColor: 'var(--anx-border-subtle)', background: 'var(--anx-surface-soft)' }}>
          <h2 className="text-xl font-bold leading-tight sm:text-2xl" style={{ color: 'var(--anx-text)' }}>{item.question}</h2>
        </div>
        <p className="text-sm" style={{ color: 'var(--anx-text-muted)' }}>
          {itemContent.type === 'SHORT_NUMERIC'
            ? 'Type your answer as a number.'
            : itemContent.type === 'SHORT_TEXT'
              ? 'Type your answer clearly.'
              : itemContent.type === 'ORDER'
                ? 'Put the answers in the right order.'
                : 'Choose one answer.'}
        </p>
        {renderAnswerInput(itemContent.type)}
        <button
          onClick={submitAnswer}
          disabled={!selectedAnswer || submitting}
          className="anx-btn-primary w-full py-3.5 text-base"
        >
          {submitting ? 'Checking\u2026' : 'Check and continue'}
        </button>
      </div>
    </main>
  );
}
