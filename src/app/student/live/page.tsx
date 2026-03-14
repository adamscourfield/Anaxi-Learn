'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

interface SkillMeta {
  id: string;
  code: string;
  name: string;
}

interface SubjectMeta {
  id: string;
  title: string;
  slug: string;
}

interface JoinedSession {
  sessionId: string;
  status: string;
  subject: SubjectMeta;
  skill: SkillMeta | null;
}

interface Item {
  id: string;
  question: string;
  type: string;
  options: unknown;
}

type AppState =
  | { phase: 'join' }
  | { phase: 'waiting'; session: JoinedSession }
  | { phase: 'question'; session: JoinedSession; item: Item }
  | { phase: 'feedback'; session: JoinedSession; correct: boolean; nextItem: Item | null }
  | { phase: 'done'; session: JoinedSession };

export default function StudentLivePage() {
  const { data: authSession, status } = useSession();
  const [joinCode, setJoinCode] = useState('');
  const [appState, setAppState] = useState<AppState>({ phase: 'join' });
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'loading') return <div className="p-8 text-gray-500">Loading…</div>;
  if (status === 'unauthenticated') {
    redirect('/login');
  }

  const user = authSession?.user as { role?: string } | undefined;
  if (user?.role !== 'STUDENT') {
    redirect('/dashboard');
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/live-sessions/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode: joinCode.toUpperCase() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Could not join session.');
        return;
      }
      const session: JoinedSession = await res.json();

      if (session.status === 'LOBBY') {
        setAppState({ phase: 'waiting', session });
      } else {
        // Session is already active — fetch first question
        await fetchFirstQuestion(session);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function fetchFirstQuestion(session: JoinedSession) {
    // The item serving happens through the attempts response.
    // Show a waiting screen until the teacher starts the session.
    setAppState({ phase: 'waiting', session });
  }

  async function handleAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (appState.phase !== 'question') return;
    setError(null);
    setLoading(true);

    const { session, item } = appState;
    const skillId = session.skill?.id;
    if (!skillId) {
      setError('No skill associated with this session.');
      setLoading(false);
      return;
    }

    try {
      const start = Date.now();
      const res = await fetch(`/api/live-sessions/${session.sessionId}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          skillId,
          answer,
          responseTimeMs: Date.now() - start,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to submit answer.');
        return;
      }

      const result: { correct: boolean; nextItem: Item | null } = await res.json();
      setAnswer('');
      setAppState({
        phase: 'feedback',
        session,
        correct: result.correct,
        nextItem: result.nextItem,
      });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleNext() {
    if (appState.phase !== 'feedback') return;
    const { session, nextItem } = appState;
    if (!nextItem) {
      setAppState({ phase: 'done', session });
    } else {
      setAppState({ phase: 'question', session, item: nextItem });
    }
  }

  // Render join screen
  if (appState.phase === 'join') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">Join Live Session</h1>
          {error && (
            <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label htmlFor="joinCode" className="mb-1 block text-sm font-medium text-gray-700">
                Session code
              </label>
              <input
                id="joinCode"
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ABC123"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-center text-xl font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || joinCode.length !== 6}
              className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Joining…' : 'Join'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Waiting for session to start
  if (appState.phase === 'waiting') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mb-4 text-4xl">⏳</div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Waiting for your teacher…</h2>
          <p className="text-sm text-gray-500">
            You&apos;ve joined <strong>{appState.session.subject.title}</strong>.
            The session will begin shortly.
          </p>
        </div>
      </main>
    );
  }

  // Question screen
  if (appState.phase === 'question') {
    const { item } = appState;
    const opts = Array.isArray(item.options) ? (item.options as string[]) : [];
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          {error && (
            <div className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          <p className="mb-6 text-lg text-gray-800">{item.question}</p>
          <form onSubmit={handleAnswer} className="space-y-3">
            {opts.length > 0 ? (
              opts.map((opt) => (
                <label
                  key={opt}
                  className={`flex cursor-pointer items-center gap-3 rounded-md border px-4 py-3 text-sm transition-colors ${
                    answer === opt
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="answer"
                    value={opt}
                    checked={answer === opt}
                    onChange={() => setAnswer(opt)}
                    className="accent-indigo-600"
                  />
                  {opt}
                </label>
              ))
            ) : (
              <input
                type="text"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Your answer…"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            )}
            <button
              type="submit"
              disabled={loading || !answer}
              className="mt-2 w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Submitting…' : 'Submit'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Feedback screen
  if (appState.phase === 'feedback') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mb-4 text-5xl">
            {appState.correct ? '✅' : '❌'}
          </div>
          <h2 className={`mb-4 text-xl font-bold ${appState.correct ? 'text-green-700' : 'text-red-700'}`}>
            {appState.correct ? 'Correct!' : 'Not quite…'}
          </h2>
          <button
            onClick={handleNext}
            className="rounded-md bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {appState.nextItem ? 'Next question →' : 'Finish'}
          </button>
        </div>
      </main>
    );
  }

  // Done screen
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-4 text-5xl">🎉</div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">All done!</h2>
        <p className="text-sm text-gray-500">You&apos;ve completed all questions for this session.</p>
      </div>
    </main>
  );
}
