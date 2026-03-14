'use client';

import { useEffect, useState } from 'react';

interface Props {
  sessionId: string;
  status: 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  joinCode: string;
  startedAt: string | null;
  participantCount: number;
  onStatusChange: (status: 'ACTIVE' | 'PAUSED' | 'COMPLETED') => void;
}

const statusBadge: Record<string, string> = {
  LOBBY: 'bg-gray-100 text-gray-700',
  ACTIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-red-100 text-red-700',
};

function useElapsed(startedAt: string | null, isActive: boolean) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt || !isActive) return;
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, isActive]);

  return elapsed;
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SessionControls({
  sessionId,
  status,
  joinCode,
  startedAt,
  participantCount,
  onStatusChange,
}: Props) {
  const [loading, setLoading] = useState(false);
  const elapsed = useElapsed(startedAt, status === 'ACTIVE');

  async function updateStatus(newStatus: 'ACTIVE' | 'PAUSED' | 'COMPLETED') {
    setLoading(true);
    try {
      await fetch(`/api/live-sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      onStatusChange(newStatus);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <span className="block text-xs text-gray-500">Join Code</span>
          <span className="text-2xl font-bold tracking-widest text-indigo-600">{joinCode}</span>
        </div>
        <div>
          <span className="block text-xs text-gray-500">Status</span>
          <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${statusBadge[status]}`}>
            {status}
          </span>
        </div>
        {startedAt && (
          <div>
            <span className="block text-xs text-gray-500">Elapsed</span>
            <span className="text-sm font-mono text-gray-700">{formatElapsed(elapsed)}</span>
          </div>
        )}
        <div>
          <span className="block text-xs text-gray-500">Students</span>
          <span className="text-sm font-semibold text-gray-700">{participantCount}</span>
        </div>
      </div>
      <div className="flex gap-2">
        {status === 'LOBBY' && (
          <button
            onClick={() => updateStatus('ACTIVE')}
            disabled={loading}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Start Session
          </button>
        )}
        {status === 'ACTIVE' && (
          <button
            onClick={() => updateStatus('PAUSED')}
            disabled={loading}
            className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
          >
            Pause
          </button>
        )}
        {status === 'PAUSED' && (
          <button
            onClick={() => updateStatus('ACTIVE')}
            disabled={loading}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Resume
          </button>
        )}
        {(status === 'ACTIVE' || status === 'PAUSED') && (
          <button
            onClick={() => updateStatus('COMPLETED')}
            disabled={loading}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            End Session
          </button>
        )}
      </div>
    </div>
  );
}
