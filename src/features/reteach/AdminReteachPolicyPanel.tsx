'use client';

import { useEffect, useState } from 'react';

interface Policy {
  checkpointAccuracyTrigger: number;
  wrongFirstDifferenceTrigger: number;
  interactionPassTrigger: number;
  dleTrendTrigger: number;
  gateConsecutiveIndependentCorrect: number;
  gateIndependentRateWindow: number;
  gateIndependentRateMin: number;
  gateEscalateAfterFailedLoops: number;
}

export function AdminReteachPolicyPanel() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/reteach-policy')
      .then((r) => r.json())
      .then((data) => setPolicy(data.policy as Policy))
      .catch(() => setMessage('Could not load reteach policy.'));
  }, []);

  if (!policy) {
    return <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">Loading Phase 9 thresholds…</div>;
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/reteach-policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
      });
      if (!res.ok) throw new Error('save failed');
      setMessage('Saved. New policy is now live for routing and gate decisions.');
    } catch {
      setMessage('Could not save policy.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">Phase 9 Threshold Controls</h2>
      <p className="mt-1 text-xs text-gray-600">Tune reteach triggers and gate thresholds without redeploying.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(policy) as Array<keyof Policy>).map((key) => (
          <label key={String(key)} className="text-xs text-gray-600">
            <div className="mb-1">{String(key)}</div>
            <input
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-800"
              type="number"
              step="0.01"
              value={policy[key]}
              onChange={(e) =>
                setPolicy((prev) => (prev ? { ...prev, [key]: Number(e.target.value) } : prev))
              }
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save thresholds'}
        </button>
        {message && <p className="text-xs text-gray-600">{message}</p>}
      </div>
    </div>
  );
}
