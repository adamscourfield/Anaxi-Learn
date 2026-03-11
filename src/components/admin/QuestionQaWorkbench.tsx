'use client';

import { useEffect, useMemo, useState } from 'react';
import { gradeAttempt, getAnswerFormatHint } from '@/features/learn/gradeAttempt';
import { parseItemOptions, type AnswerType } from '@/features/items/itemMeta';

interface QaIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

interface QaItem {
  id: string;
  question: string;
  displayQuestion: string;
  type: string;
  answerType: AnswerType;
  answerModeLabel: string;
  answer: string;
  options: unknown;
  skills: string[];
  issues: QaIssue[];
  reviewNotes: Array<{
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
}

export function QuestionQaWorkbench({ items, availableSkills }: Props) {
  const [localItems, setLocalItems] = useState(items);
  const [skillFilter, setSkillFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ISSUES' | 'CLEAN'>('ALL');
  const [repairFilter, setRepairFilter] = useState<'ALL' | 'OPEN_ONLY' | 'WITH_NOTES'>('ALL');
  const [modeFilter, setModeFilter] = useState<'ALL' | AnswerType>('ALL');
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? '');
  const [draftAnswer, setDraftAnswer] = useState('');
  const [submittedAnswer, setSubmittedAnswer] = useState('');
  const [noteCategory, setNoteCategory] = useState<QaItem['reviewNotes'][number]['category']>('ANSWER_MODE');
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setLocalItems(items);
    setSelectedId((currentSelectedId) => {
      if (currentSelectedId && items.some((item) => item.id === currentSelectedId)) {
        return currentSelectedId;
      }

      return items[0]?.id ?? '';
    });
  }, [items]);

  const filteredItems = useMemo(
    () =>
      localItems.filter((item) => {
        if (skillFilter !== 'ALL' && !item.skills.includes(skillFilter)) return false;
        if (statusFilter === 'ISSUES' && item.issues.length === 0) return false;
        if (statusFilter === 'CLEAN' && item.issues.length > 0) return false;
        if (modeFilter !== 'ALL' && item.answerType !== modeFilter) return false;
        if (repairFilter === 'OPEN_ONLY' && !item.reviewNotes.some((note) => note.status === 'OPEN')) return false;
        if (repairFilter === 'WITH_NOTES' && item.reviewNotes.length === 0) return false;
        return true;
      }),
    [localItems, modeFilter, repairFilter, skillFilter, statusFilter]
  );

  useEffect(() => {
    if (!filteredItems.some((item) => item.id === selectedId)) {
      setSelectedId(filteredItems[0]?.id ?? '');
      setDraftAnswer('');
      setSubmittedAnswer('');
    }
  }, [filteredItems, selectedId]);

  const currentItem = filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null;
  const parsedOptions = currentItem ? parseItemOptions(currentItem.options) : null;
  const openReviewNotes = currentItem?.reviewNotes.filter((note) => note.status === 'OPEN') ?? [];
  const grading = currentItem && submittedAnswer
    ? {
        correct: gradeAttempt(currentItem.answer, submittedAnswer),
      }
    : null;

  async function createReviewNote() {
    if (!currentItem || !noteText.trim()) return;

    setSavingNote(true);
    setSaveError('');

    try {
      const response = await fetch('/api/admin/items/review-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: currentItem.id,
          category: noteCategory,
          note: noteText.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Could not save repair note');
      }

      const createdNote = await response.json();
      setLocalItems((prev) =>
        prev.map((item) =>
          item.id === currentItem.id
            ? {
                ...item,
                reviewNotes: [createdNote, ...item.reviewNotes],
              }
            : item
        )
      );
      setNoteText('');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save repair note');
    } finally {
      setSavingNote(false);
    }
  }

  async function resolveReviewNote(noteId: string) {
    if (!currentItem) return;

    try {
      const response = await fetch(`/api/admin/items/review-notes/${noteId}/resolve`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Could not resolve repair note');
      }

      const resolvedNote = await response.json();
      setLocalItems((prev) =>
        prev.map((item) =>
          item.id === currentItem.id
            ? {
                ...item,
                reviewNotes: item.reviewNotes.map((note) => (note.id === noteId ? resolvedNote : note)),
              }
            : item
        )
      );
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not resolve repair note');
    }
  }

  function renderStudentInput() {
    if (!currentItem || !parsedOptions) return null;

    if (currentItem.answerType === 'SHORT_TEXT' || currentItem.answerType === 'SHORT_NUMERIC') {
      return (
        <input
          value={draftAnswer}
          onChange={(e) => setDraftAnswer(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
          placeholder={currentItem.answerType === 'SHORT_NUMERIC' ? 'Type a number' : 'Type an answer'}
        />
      );
    }

    return (
      <div className="space-y-2">
        {parsedOptions.choices.map((choice) => (
          <button
            key={choice}
            onClick={() => setDraftAnswer(choice)}
            className={`block w-full rounded-lg border px-4 py-3 text-left text-sm ${
              draftAnswer === choice
                ? 'border-blue-500 bg-blue-50 text-blue-900'
                : 'border-slate-200 bg-white text-slate-700'
            }`}
          >
            {choice}
          </button>
        ))}
      </div>
    );
  }

  if (!currentItem || !parsedOptions) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No questions match the current filters.</div>;
  }

  const answerHint = getAnswerFormatHint(currentItem.type, currentItem.question, currentItem.options);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
      <aside className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Skill</span>
              <select
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="ALL">All skills</option>
                {availableSkills.map((skill) => (
                  <option key={skill} value={skill}>{skill}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Status</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ISSUES' | 'CLEAN')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="ALL">All items</option>
                <option value="ISSUES">Flagged only</option>
                <option value="CLEAN">Clean only</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Repair notes</span>
              <select
                value={repairFilter}
                onChange={(e) => setRepairFilter(e.target.value as 'ALL' | 'OPEN_ONLY' | 'WITH_NOTES')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="ALL">All items</option>
                <option value="OPEN_ONLY">Open repairs only</option>
                <option value="WITH_NOTES">Any notes</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Answer mode</span>
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value as 'ALL' | AnswerType)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="ALL">All modes</option>
                <option value="MCQ">Single-choice</option>
                <option value="TRUE_FALSE">True / False</option>
                <option value="SHORT_TEXT">Short text</option>
                <option value="SHORT_NUMERIC">Short numeric</option>
              </select>
            </label>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Showing {filteredItems.length} of {localItems.length} questions
          </p>
        </div>

        <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white">
          {filteredItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => {
                setSelectedId(item.id);
                setDraftAnswer('');
                setSubmittedAnswer('');
              }}
              className={`block w-full border-b border-slate-100 px-4 py-3 text-left ${item.id === currentItem.id ? 'bg-blue-50' : 'bg-white'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-500">Q{index + 1}</span>
                <div className="flex items-center gap-2">
                  {item.reviewNotes.some((note) => note.status === 'OPEN') && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      {item.reviewNotes.filter((note) => note.status === 'OPEN').length} open repair
                    </span>
                  )}
                  {item.issues.length > 0 && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      {item.issues.length} issue{item.issues.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-800">{item.displayQuestion}</p>
            </button>
          ))}
        </div>
      </aside>

      <section className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              Stored type: {currentItem.type}
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
              Student answers with: {currentItem.answerModeLabel}
            </span>
            {openReviewNotes.length > 0 && (
              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                {openReviewNotes.length} open repair note{openReviewNotes.length !== 1 ? 's' : ''}
              </span>
            )}
            {currentItem.skills.map((skill) => (
              <span key={skill} className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                {skill}
              </span>
            ))}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr,0.9fr]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-sm font-semibold text-slate-900">Student Preview</h2>
              <p className="mt-3 text-lg font-semibold text-slate-900">{currentItem.displayQuestion}</p>
              {answerHint && <p className="mt-2 text-sm text-slate-600">{answerHint}</p>}
              <div className="mt-4">{renderStudentInput()}</div>
              <button
                onClick={() => setSubmittedAnswer(draftAnswer)}
                disabled={!draftAnswer}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Test this answer
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-900">Stored Contract</h3>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-slate-500">Raw stored question</dt>
                    <dd className="text-slate-800">{currentItem.question}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Stored answer</dt>
                    <dd className="font-medium text-slate-900">{currentItem.answer}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Student choices</dt>
                    <dd className="text-slate-800">{parsedOptions.choices.length > 0 ? parsedOptions.choices.join(', ') : 'No fixed choices'}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-900">Grading Result</h3>
                {grading ? (
                  <div className="mt-4 space-y-3 text-sm">
                    <div className={`inline-flex rounded-full px-3 py-1 font-medium ${grading.correct ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {grading.correct ? 'Marked correct' : 'Marked incorrect'}
                    </div>
                    <div>
                      <div className="text-slate-500">Submitted answer</div>
                      <div className="text-slate-900">{submittedAnswer}</div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">Test an answer to inspect grading behaviour.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Contract Checks</h3>
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

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Repair Notes</h3>
          <p className="mt-2 text-sm text-slate-600">
            Save repair requirements against this question so you can pause and come back later.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-[220px,1fr]">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-600">Category</span>
              <select
                value={noteCategory}
                onChange={(e) => setNoteCategory(e.target.value as QaItem['reviewNotes'][number]['category'])}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
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
              <span className="mb-1 block text-slate-600">Repair note</span>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Describe what needs to change and why."
              />
            </label>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={createReviewNote}
              disabled={savingNote || !noteText.trim()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {savingNote ? 'Saving...' : 'Save repair note'}
            </button>
            {saveError && <p className="text-sm text-red-700">{saveError}</p>}
          </div>

          <div className="mt-6 space-y-3">
            {currentItem.reviewNotes.length > 0 ? (
              currentItem.reviewNotes.map((note) => (
                <div key={note.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
                      {note.category.replaceAll('_', ' ')}
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        note.status === 'OPEN'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-green-50 text-green-700'
                      }`}
                    >
                      {note.status === 'OPEN' ? 'Open' : 'Resolved'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {note.authorLabel} · {new Date(note.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-800">{note.note}</p>
                  {note.status === 'RESOLVED' && note.resolvedAt ? (
                    <p className="mt-2 text-xs text-slate-500">Resolved {new Date(note.resolvedAt).toLocaleString()}</p>
                  ) : (
                    <button
                      onClick={() => resolveReviewNote(note.id)}
                      className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                    >
                      Mark resolved
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No repair notes saved for this question yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
