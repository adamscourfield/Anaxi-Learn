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
        <div className="anx-card-flat p-4">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--anx-text)' }}>Staged batches</h2>
          <div className="mt-4 space-y-2">
            {batches.map((batch) => (
              <button
                key={batch.id}
                onClick={() => setSelectedBatch(batch.id)}
                className="block w-full rounded-lg border px-3 py-3 text-left"
                style={batch.id === selectedBatch ? { borderColor: 'var(--anx-primary)', background: 'var(--anx-primary-soft)' } : { borderColor: 'var(--anx-border)' }}
              >
                <div className="text-sm font-medium" style={{ color: 'var(--anx-text)' }}>{batch.batchLabel}</div>
                <div className="mt-1 text-xs" style={{ color: 'var(--anx-text-muted)' }}>{batch.itemCount} staged items</div>
              </button>
            ))}
          </div>
        </div>

        <div className="anx-card-flat p-4">
          <label className="block text-sm">
            <span className="anx-label mb-1 block">Issue severity</span>
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as 'ALL' | 'ERROR' | 'WARNING')}
              className="anx-select w-full"
            >
              <option value="ALL">All</option>
              <option value="ERROR">Errors only</option>
              <option value="WARNING">Warnings only</option>
            </select>
          </label>
          <button
            onClick={() => void publishValidItems()}
            className="anx-btn-primary mt-4 w-full text-sm disabled:opacity-60"
            disabled={!selectedBatch || publishState === 'saving'}
          >
            {publishState === 'saving' ? 'Publishing…' : 'Publish valid items from batch'}
          </button>
          {publishState === 'done' && <p className="mt-2 text-xs" style={{ color: 'var(--anx-success)' }}>Publish pass completed.</p>}
          {publishState === 'failed' && <p className="mt-2 text-xs" style={{ color: 'var(--anx-danger)' }}>Publish pass failed.</p>}
        </div>
      </aside>

      <section className="space-y-4">
        <div className="anx-card-flat p-4 text-sm" style={{ color: 'var(--anx-text-secondary)' }}>
          Showing {filteredEntries.length} of {currentEntries.length} staged items.
        </div>
        {filteredEntries.map((entry, index) => (
          <article key={`${selectedBatch}-${index}`} className="anx-card-flat p-5 space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className="anx-badge anx-badge-blue rounded-full px-2 py-1 text-xs font-medium">
                {entry.question.provenance.slideOrPageRef}
              </span>
              <span className="anx-badge anx-badge-blue rounded-full px-2 py-1 text-xs font-medium">
                {entry.question.curriculum.objectiveId ?? 'Unmapped objective'}
              </span>
              {entry.question.adaptive.answerModeAllowed.map((mode) => (
                <span key={mode} className="anx-badge anx-badge-green rounded-full px-2 py-1 text-xs font-medium">
                  {mode}
                </span>
              ))}
            </div>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--anx-text)' }}>{entry.question.stem}</h3>
            <div className="grid gap-4 md:grid-cols-2 text-sm">
              <div>
                <div className="font-medium" style={{ color: 'var(--anx-text-secondary)' }}>Curriculum</div>
                <div className="mt-1" style={{ color: 'var(--anx-text-secondary)' }}>{entry.question.curriculum.subtopic}</div>
                <div style={{ color: 'var(--anx-text-muted)' }}>{entry.question.curriculum.yearBand} · {entry.question.curriculum.strand}</div>
              </div>
              <div>
                <div className="font-medium" style={{ color: 'var(--anx-text-secondary)' }}>Marking</div>
                <div className="mt-1" style={{ color: 'var(--anx-text-secondary)' }}>{entry.question.marking.markingMethod}</div>
                <div style={{ color: 'var(--anx-text-muted)' }}>Answer: {entry.question.marking.correctAnswer || 'Unclear'}</div>
              </div>
            </div>
            <div className="anx-alert anx-alert-warning rounded-lg p-3">
              <div className="text-xs font-semibold">Review issues</div>
              <ul className="mt-2 space-y-1 text-sm">
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
