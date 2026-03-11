'use client';

import { useEffect, useMemo, useState } from 'react';
import { getItemContent, gradeAttempt, normalizeAnswer, type ItemInteractionType } from '@/features/learn/itemContent';

interface QaItem {
  id: string;
  question: string;
  type: string;
  answer: string;
  options: unknown;
  skills: string[];
  issues: Array<{ code: string; message: string; severity: 'error' | 'warning' }>;
}

interface Props {
  items: QaItem[];
  availableSkills: string[];
}

export function QuestionQaWorkbench({ items, availableSkills }: Props) {
  const [skillFilter, setSkillFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ISSUES' | 'CLEAN'>('ALL');
  const [modeFilter, setModeFilter] = useState<'ALL' | ItemInteractionType>('ALL');
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? '');
  const [draftAnswer, setDraftAnswer] = useState('');
  const [submittedAnswer, setSubmittedAnswer] = useState('');

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (skillFilter !== 'ALL' && !item.skills.includes(skillFilter)) return false;
      if (statusFilter === 'ISSUES' && item.issues.length === 0) return false;
      if (statusFilter === 'CLEAN' && item.issues.length > 0) return false;
      if (modeFilter !== 'ALL' && getItemContent(item).type !== modeFilter) return false;
      return true;
    });
  }, [items, modeFilter, skillFilter, statusFilter]);

  useEffect(() => {
    if (!filteredItems.some((item) => item.id === selectedId)) {
      setSelectedId(filteredItems[0]?.id ?? '');
      setDraftAnswer('');
      setSubmittedAnswer('');
    }
  }, [filteredItems, selectedId]);

  const currentItem = filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null;
  const itemContent = currentItem ? getItemContent(currentItem) : null;
  const modeLabel = itemContent
    ? ({
        MCQ: 'Single-choice buttons',
        TRUE_FALSE: 'True / False buttons',
        SHORT_TEXT: 'Typed short answer',
        ORDER: 'Tap-to-order sequence',
      } satisfies Record<ItemInteractionType, string>)[itemContent.type]
    : null;
  const gradingResult = currentItem && submittedAnswer
    ? {
        normalizedInput: normalizeAnswer(submittedAnswer),
        matchedAnswer: itemContent?.acceptedAnswers.find(
          (answer) => normalizeAnswer(answer) === normalizeAnswer(submittedAnswer)
        ) ?? null,
        correct: gradeAttempt(itemContent?.acceptedAnswers ?? [], submittedAnswer),
      }
    : null;

  function toggleOrderedChoice(choice: string) {
    const currentOrder = draftAnswer ? draftAnswer.split(' | ') : [];
    if (currentOrder.includes(choice)) {
      setDraftAnswer(currentOrder.filter((entry) => entry !== choice).join(' | '));
      return;
    }

    setDraftAnswer([...currentOrder, choice].join(' | '));
  }

  function renderInput(type: ItemInteractionType) {
    if (!itemContent) return null;

    if (type === 'SHORT_TEXT') {
      return (
        <input
          value={draftAnswer}
          onChange={(e) => setDraftAnswer(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
          placeholder="Type a test answer"
        />
      );
    }

    if (type === 'ORDER') {
      const currentOrder = draftAnswer ? draftAnswer.split(' | ') : [];
      return (
        <div className="space-y-4">
          <div className="min-h-12 rounded-lg border border-dashed border-blue-200 bg-blue-50 p-3">
            {currentOrder.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {currentOrder.map((choice) => (
                  <button
                    key={choice}
                    onClick={() => toggleOrderedChoice(choice)}
                    className="rounded-full bg-blue-600 px-3 py-1 text-sm text-white"
                  >
                    {choice}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-sm text-blue-700">Tap values below in the order a student should enter them.</span>
            )}
          </div>
          <div className="space-y-2">
            {itemContent.choices.map((choice) => (
              <button
                key={choice}
                onClick={() => toggleOrderedChoice(choice)}
                className={`block w-full rounded-lg border px-4 py-3 text-left text-sm ${
                  currentOrder.includes(choice)
                    ? 'border-blue-500 bg-blue-50 text-blue-900'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                {choice}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {itemContent.choices.map((choice) => (
          <button
            key={choice}
            onClick={() => setDraftAnswer(choice)}
            className={`block w-full rounded-lg border px-4 py-3 text-left text-sm ${
              draftAnswer === choice
                ? 'border-blue-500 bg-blue-50 text-blue-900'
                : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            {choice}
          </button>
        ))}
      </div>
    );
  }

  if (!currentItem || !itemContent) {
    return <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">No questions match the current filter.</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
      <aside className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Filters</h2>
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">Skill</span>
              <select
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="ALL">All skills</option>
                {availableSkills.map((skill) => (
                  <option key={skill} value={skill}>{skill}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ISSUES' | 'CLEAN')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="ALL">All items</option>
                <option value="ISSUES">Only flagged items</option>
                <option value="CLEAN">Only clean items</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">Answer mode</span>
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value as 'ALL' | ItemInteractionType)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="ALL">All modes</option>
                <option value="MCQ">Single-choice</option>
                <option value="TRUE_FALSE">True / False</option>
                <option value="SHORT_TEXT">Short answer</option>
                <option value="ORDER">Ordered sequence</option>
              </select>
            </label>
          </div>
          <div className="mt-4 text-xs text-gray-500">
            Showing {filteredItems.length} of {items.length} questions
          </div>
        </div>

        <div className="max-h-[70vh] overflow-auto rounded-xl border border-gray-200 bg-white">
          {filteredItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => {
                setSelectedId(item.id);
                setDraftAnswer('');
                setSubmittedAnswer('');
              }}
              className={`block w-full border-b border-gray-100 px-4 py-3 text-left ${
                item.id === currentItem.id ? 'bg-blue-50' : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-gray-500">Q{index + 1}</span>
                {item.issues.length > 0 && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                    {item.issues.length} issue{item.issues.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-800">{item.question}</p>
            </button>
          ))}
        </div>
      </aside>

      <section className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
              {currentItem.type}
            </span>
            {modeLabel && (
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                Student answers with: {modeLabel}
              </span>
            )}
            {currentItem.skills.map((skill) => (
              <span key={skill} className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                {skill}
              </span>
            ))}
          </div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">{currentItem.question}</h2>

          <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-900">Student Preview</h3>
            {modeLabel && (
              <p className="mt-2 text-sm text-gray-600">
                This question currently renders as: <span className="font-medium text-gray-900">{modeLabel}</span>
              </p>
            )}
            <div className="mt-4">{renderInput(itemContent.type)}</div>
            <button
              onClick={() => setSubmittedAnswer(draftAnswer)}
              disabled={!draftAnswer}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Test this answer
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Stored Contract</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Canonical answer</dt>
                <dd className="font-medium text-gray-900">{itemContent.canonicalAnswer}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Accepted answers</dt>
                <dd className="text-gray-800">{itemContent.acceptedAnswers.join(', ')}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Choices</dt>
                <dd className="text-gray-800">{itemContent.choices.length > 0 ? itemContent.choices.join(', ') : 'No fixed choices'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Grading Result</h3>
            {gradingResult ? (
              <div className="mt-4 space-y-3 text-sm">
                <div className={`inline-flex rounded-full px-3 py-1 font-medium ${gradingResult.correct ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {gradingResult.correct ? 'Marked correct' : 'Marked incorrect'}
                </div>
                <div>
                  <div className="text-gray-500">Submitted answer</div>
                  <div className="text-gray-900">{submittedAnswer}</div>
                </div>
                <div>
                  <div className="text-gray-500">Normalized input</div>
                  <div className="font-mono text-xs text-gray-800">{gradingResult.normalizedInput}</div>
                </div>
                <div>
                  <div className="text-gray-500">Matched accepted answer</div>
                  <div className="text-gray-900">{gradingResult.matchedAnswer ?? 'No match'}</div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">Test an answer to see exactly how grading behaves.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900">Contract Checks</h3>
          {currentItem.issues.length > 0 ? (
            <div className="mt-4 space-y-2">
              {currentItem.issues.map((issue) => (
                <div
                  key={issue.code}
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    issue.severity === 'error'
                      ? 'border-red-200 bg-red-50 text-red-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
                >
                  <div className="font-medium">{issue.code}</div>
                  <div>{issue.message}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-green-700">No contract issues detected for this item.</p>
          )}
        </div>
      </section>
    </div>
  );
}
