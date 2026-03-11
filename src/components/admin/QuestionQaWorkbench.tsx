'use client';

import { useEffect, useMemo, useState } from 'react';
import { OrderedMagnetInput } from '@/components/learn/OrderedMagnetInput';
import { ItemVisualPanel } from '@/components/learn/ItemVisualPanel';
import { getItemContent, gradeAttempt, normalizeAnswer, type ItemInteractionType } from '@/features/learn/itemContent';

type ReviewCategory =
  | 'ANSWER_MODE'
  | 'ANSWER_MAPPING'
  | 'STEM_COPY'
  | 'DISTRACTOR_QUALITY'
  | 'SKILL_MAPPING'
  | 'OTHER';

interface QaItem {
  id: string;
  question: string;
  displayQuestion: string;
  type: string;
  answerType: 'MCQ' | 'SHORT_TEXT' | 'SHORT_NUMERIC' | 'TRUE_FALSE';
  answerModeLabel: string;
  answer: string;
  options: unknown;
  skills: string[];
  primarySkillCode: string;
  primarySkillSortOrder: number;
  questionPurpose: 'ONBOARDING' | 'LEARN' | 'RETEACH_SHADOW';
  isPlaceholder: boolean;
  sequenceKey: {
    diagnosticOrdinal: number;
    questionOrdinal: number;
    questionAlphaOrder: number;
    shadowRoute: string | null;
    shadowOrdinal: number;
    createdAt: string | null;
    displayQuestion: string;
  };
  issues: Array<{ code: string; message: string; severity: 'error' | 'warning' }>;
  reviewNotes?: Array<{
    id: string;
    status: 'OPEN' | 'RESOLVED';
    category: 'ANSWER_MODE' | 'ANSWER_MAPPING' | 'STEM_COPY' | 'DISTRACTOR_QUALITY' | 'SKILL_MAPPING' | 'OTHER';
    note: string;
    createdAt: string;
    resolvedAt: string | null;
    authorLabel: string;
  }>;
}

interface Props {
  items: QaItem[];
  availableSkills: string[];
  availableTypes?: string[];
}

export function QuestionQaWorkbench({ items, availableSkills, availableTypes = [] }: Props) {
  const [localItems, setLocalItems] = useState(items);
  const [skillFilter, setSkillFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ISSUES' | 'CLEAN'>('ALL');
  const [reviewFilter, setReviewFilter] = useState<'ALL' | 'OPEN_ONLY' | 'HAS_ANY' | 'NONE'>('ALL');
  const [modeFilter, setModeFilter] = useState<'ALL' | ItemInteractionType>('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [contentFilter, setContentFilter] = useState<'REAL_ONLY' | 'ALL' | 'PLACEHOLDERS'>('REAL_ONLY');
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? '');
  const [draftAnswer, setDraftAnswer] = useState('');
  const [submittedAnswer, setSubmittedAnswer] = useState('');
  const [noteCategory, setNoteCategory] = useState<ReviewCategory>('ANSWER_MODE');
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [resolvingNoteId, setResolvingNoteId] = useState<string | null>(null);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const filteredItems = useMemo(() => {
    return localItems.filter((item) => {
      if (skillFilter !== 'ALL' && !item.skills.includes(skillFilter)) return false;
      if (statusFilter === 'ISSUES' && item.issues.length === 0) return false;
      if (statusFilter === 'CLEAN' && item.issues.length > 0) return false;
      if (reviewFilter === 'OPEN_ONLY' && !(item.reviewNotes ?? []).some((note) => note.status === 'OPEN')) return false;
      if (reviewFilter === 'HAS_ANY' && (item.reviewNotes ?? []).length === 0) return false;
      if (reviewFilter === 'NONE' && (item.reviewNotes ?? []).length > 0) return false;
      if (contentFilter === 'REAL_ONLY' && item.isPlaceholder) return false;
      if (contentFilter === 'PLACEHOLDERS' && !item.isPlaceholder) return false;
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
      if (modeFilter !== 'ALL' && getItemContent(item).type !== modeFilter) return false;
      return true;
    });
  }, [contentFilter, localItems, modeFilter, reviewFilter, skillFilter, statusFilter, typeFilter]);

  useEffect(() => {
    if (!filteredItems.some((item) => item.id === selectedId)) {
      setSelectedId(filteredItems[0]?.id ?? '');
      setDraftAnswer('');
      setSubmittedAnswer('');
    }
    setNoteDraft('');
    setNoteError(null);
  }, [filteredItems, selectedId]);

  const currentItem = filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null;
  const itemContent = currentItem ? getItemContent(currentItem) : null;
  const modeLabel = itemContent
    ? ({
        MCQ: 'Single-choice buttons',
        TRUE_FALSE: 'True / False buttons',
        SHORT_TEXT: 'Typed short answer',
        SHORT_NUMERIC: 'Typed numeric answer',
        ORDER: 'Drag-and-drop fridge magnets',
      } satisfies Record<ItemInteractionType, string>)[itemContent.type]
    : null;

  async function saveReviewNote() {
    if (!currentItem || !noteDraft.trim()) return;

    setSavingNote(true);
    setNoteError(null);
    try {
      const res = await fetch('/api/admin/items/review-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: currentItem.id,
          category: noteCategory,
          note: noteDraft.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error('Could not save review note.');
      }

      const createdNote = await res.json();
      setLocalItems((prev) =>
        prev.map((item) =>
          item.id === currentItem.id
            ? { ...item, reviewNotes: [createdNote, ...(item.reviewNotes ?? [])] }
            : item
        )
      );
      setNoteDraft('');
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : 'Could not save review note.');
    } finally {
      setSavingNote(false);
    }
  }

  async function resolveReviewNote(noteId: string) {
    setResolvingNoteId(noteId);
    setNoteError(null);
    try {
      const res = await fetch(`/api/admin/items/review-notes/${noteId}/resolve`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('Could not resolve review note.');
      }

      const resolvedNote = await res.json();
      setLocalItems((prev) =>
        prev.map((item) => ({
          ...item,
          reviewNotes: (item.reviewNotes ?? []).map((note) => (note.id === noteId ? resolvedNote : note)),
        }))
      );
    } catch (error) {
      setNoteError(error instanceof Error ? error.message : 'Could not resolve review note.');
    } finally {
      setResolvingNoteId(null);
    }
  }
  const gradingResult = currentItem && submittedAnswer
    ? {
        normalizedInput: normalizeAnswer(submittedAnswer),
        matchedAnswer: itemContent?.acceptedAnswers.find(
          (answer) => normalizeAnswer(answer) === normalizeAnswer(submittedAnswer)
        ) ?? null,
        correct: gradeAttempt(itemContent?.acceptedAnswers ?? [], submittedAnswer),
      }
    : null;

  function renderInput(type: ItemInteractionType) {
    if (!itemContent) return null;

    if (type === 'SHORT_TEXT' || type === 'SHORT_NUMERIC') {
      return (
        <input
          value={draftAnswer}
          onChange={(e) => setDraftAnswer(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
          inputMode={type === 'SHORT_NUMERIC' ? 'decimal' : 'text'}
          placeholder={type === 'SHORT_NUMERIC' ? 'Enter a test number' : 'Type a test answer'}
        />
      );
    }

    if (type === 'ORDER') {
      return (
        <OrderedMagnetInput
          choices={itemContent.choices}
          value={draftAnswer}
          onChange={setDraftAnswer}
          emptyPrompt="Drag the fridge magnets here in the order a student should build."
          helperText="Use drag and drop to mirror the learner experience."
        />
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
              <span className="mb-1 block text-gray-600">Review notes</span>
              <select
                value={reviewFilter}
                onChange={(e) => setReviewFilter(e.target.value as 'ALL' | 'OPEN_ONLY' | 'HAS_ANY' | 'NONE')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="ALL">All items</option>
                <option value="OPEN_ONLY">Open notes only</option>
                <option value="HAS_ANY">Any notes</option>
                <option value="NONE">No notes</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">Content</span>
              <select
                value={contentFilter}
                onChange={(e) => setContentFilter(e.target.value as 'REAL_ONLY' | 'ALL' | 'PLACEHOLDERS')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="REAL_ONLY">Real questions only</option>
                <option value="ALL">All rows</option>
                <option value="PLACEHOLDERS">Placeholders only</option>
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
                <option value="SHORT_NUMERIC">Numeric answer</option>
                <option value="ORDER">Ordered sequence</option>
              </select>
            </label>
            {availableTypes.length > 0 && (
              <label className="block text-sm">
                <span className="mb-1 block text-gray-600">Stored type</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="ALL">All stored types</option>
                  {availableTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="mt-4 text-xs text-gray-500">
            Showing {filteredItems.length} of {localItems.length} questions
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
                <div className="flex items-center gap-2">
                  {item.isPlaceholder && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      Placeholder
                    </span>
                  )}
                  {item.issues.length > 0 && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      {item.issues.length} issue{item.issues.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-1 text-xs font-medium text-blue-700">{item.primarySkillCode} · {item.questionPurpose}</p>
              <p className="mt-1 text-sm text-gray-800">{item.displayQuestion}</p>
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
            {currentItem.isPlaceholder && (
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                Placeholder seed row
              </span>
            )}
          </div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">{currentItem.displayQuestion}</h2>
          {currentItem.displayQuestion !== currentItem.question && (
            <p className="mt-2 text-xs text-gray-500">Stored stem: {currentItem.question}</p>
          )}
          <div className="mt-6">
            <ItemVisualPanel item={currentItem} primarySkillCode={currentItem.primarySkillCode} />
          </div>

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

        {currentItem.reviewNotes && currentItem.reviewNotes.length > 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-900">Repair Notes</h3>
            <div className="mt-4 space-y-3">
              {currentItem.reviewNotes.map((note) => (
                <div key={note.id} className="rounded-lg border border-gray-200 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {note.category}
                      </span>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                        note.status === 'OPEN' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
                      }`}>
                        {note.status}
                      </span>
                      <span className="text-xs text-gray-500">{note.authorLabel}</span>
                    </div>
                    {note.status === 'OPEN' && (
                      <button
                        onClick={() => resolveReviewNote(note.id)}
                        disabled={resolvingNoteId === note.id}
                        className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {resolvingNoteId === note.id ? 'Resolving...' : 'Mark resolved'}
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-gray-800">{note.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900">Add Review Note</h3>
          <p className="mt-2 text-sm text-gray-500">
            Record what needs repairing on this question so the fix list survives across sessions.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-[220px,1fr]">
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">Category</span>
              <select
                value={noteCategory}
                onChange={(e) => setNoteCategory(e.target.value as ReviewCategory)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="ANSWER_MODE">Answer mode</option>
                <option value="ANSWER_MAPPING">Answer mapping</option>
                <option value="STEM_COPY">Stem copy</option>
                <option value="DISTRACTOR_QUALITY">Distractor quality</option>
                <option value="SKILL_MAPPING">Skill mapping</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">Repair note</span>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="Describe exactly what needs to change for this question."
              />
            </label>
          </div>
          {noteError && <p className="mt-3 text-sm text-red-600">{noteError}</p>}
          <div className="mt-4 flex justify-end">
            <button
              onClick={saveReviewNote}
              disabled={!noteDraft.trim() || savingNote}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {savingNote ? 'Saving...' : 'Save review note'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
