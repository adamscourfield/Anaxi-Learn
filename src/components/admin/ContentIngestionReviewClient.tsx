'use client';

import { useMemo, useState } from 'react';
import type { StagedBatchEntry, StagedBatchSummary } from '@/features/content-ingestion/staging';

interface Props {
  batches: StagedBatchSummary[];
  entriesByBatch: Record<string, StagedBatchEntry[]>;
}

export function ContentIngestionReviewClient({ batches, entriesByBatch }: Props) {
  const [selectedBatch, setSelectedBatch] = useState(batches[0]?.id ?? '');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'ERROR' | 'WARNING'>('ALL');
  const [publishState, setPublishState] = useState<'idle' | 'saving' | 'done' | 'failed'>('idle');

  const currentEntries = entriesByBatch[selectedBatch] ?? [];
  const filteredEntries = useMemo(() => {
    return currentEntries.filter((entry) => {
      if (severityFilter === 'ERROR') return entry.issues.some((issue) => issue.severity === 'error');
      if (severityFilter === 'WARNING') return entry.issues.some((issue) => issue.severity === 'warning');
      return true;
    });
  }, [currentEntries, severityFilter]);

  async function publishValidItems() {
    setPublishState('saving');
    const response = await fetch('/api/admin/content-ingestion/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchFile: selectedBatch }),
    });

    setPublishState(response.ok ? 'done' : 'failed');
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
      <aside className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Staged batches</h2>
          <div className="mt-4 space-y-2">
            {batches.map((batch) => (
              <button
                key={batch.id}
                onClick={() => setSelectedBatch(batch.id)}
                className={`block w-full rounded-lg border px-3 py-3 text-left ${
                  batch.id === selectedBatch ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="text-sm font-medium text-gray-900">{batch.batchLabel}</div>
                <div className="mt-1 text-xs text-gray-500">{batch.itemCount} staged items</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Issue severity</span>
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as 'ALL' | 'ERROR' | 'WARNING')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="ALL">All</option>
              <option value="ERROR">Errors only</option>
              <option value="WARNING">Warnings only</option>
            </select>
          </label>
          <button
            onClick={() => void publishValidItems()}
            className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            disabled={!selectedBatch || publishState === 'saving'}
          >
            {publishState === 'saving' ? 'Publishing…' : 'Publish valid items from batch'}
          </button>
          {publishState === 'done' && <p className="mt-2 text-xs text-emerald-700">Publish pass completed.</p>}
          {publishState === 'failed' && <p className="mt-2 text-xs text-red-700">Publish pass failed.</p>}
        </div>
      </aside>

      <section className="space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
          Showing {filteredEntries.length} of {currentEntries.length} staged items.
        </div>
        {filteredEntries.map((entry, index) => (
          <article key={`${selectedBatch}-${index}`} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                {entry.question.provenance.slideOrPageRef}
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                {entry.question.curriculum.objectiveId ?? 'Unmapped objective'}
              </span>
              {entry.question.adaptive.answerModeAllowed.map((mode) => (
                <span key={mode} className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                  {mode}
                </span>
              ))}
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{entry.question.stem}</h3>
            <div className="grid gap-4 md:grid-cols-2 text-sm">
              <div>
                <div className="font-medium text-gray-700">Curriculum</div>
                <div className="mt-1 text-gray-600">{entry.question.curriculum.subtopic}</div>
                <div className="text-gray-500">{entry.question.curriculum.yearBand} · {entry.question.curriculum.strand}</div>
              </div>
              <div>
                <div className="font-medium text-gray-700">Marking</div>
                <div className="mt-1 text-gray-600">{entry.question.marking.markingMethod}</div>
                <div className="text-gray-500">Answer: {entry.question.marking.correctAnswer || 'Unclear'}</div>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="text-xs font-semibold text-amber-800">Review issues</div>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {entry.issues.map((issue) => (
                  <li key={`${issue.code}-${issue.message}`}>{issue.code}: {issue.message}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
