'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Classroom {
  id: string;
  name: string;
  yearGroup: string | null;
}

interface Subject {
  id: string;
  title: string;
  slug: string;
}

interface Skill {
  id: string;
  code: string;
  name: string;
  subjectId: string;
}

interface Props {
  classrooms: Classroom[];
  subjects: Subject[];
  skillsBySubject: Skill[];
}

export function NewLiveSessionForm({ classrooms, subjects, skillsBySubject }: Props) {
  const router = useRouter();
  const [classroomId, setClassroomId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [skillId, setSkillId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skillsForSubject = skillsBySubject.filter((s) => s.subjectId === subjectId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!classroomId || !subjectId) {
      setError('Please select a classroom and subject.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/live-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroomId,
          subjectId,
          skillId: skillId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to create session.');
        return;
      }

      const session = await res.json();
      router.push(`/teacher/live/${session.id}`);
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      {error && (
        <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="classroom">
          Classroom
        </label>
        <select
          id="classroom"
          value={classroomId}
          onChange={(e) => setClassroomId(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        >
          <option value="">Select classroom…</option>
          {classrooms.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.yearGroup ? ` (${c.yearGroup})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="subject">
          Subject
        </label>
        <select
          id="subject"
          value={subjectId}
          onChange={(e) => { setSubjectId(e.target.value); setSkillId(''); }}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          required
        >
          <option value="">Select subject…</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="skill">
          Skill <span className="text-gray-400">(optional)</span>
        </label>
        <select
          id="skill"
          value={skillId}
          onChange={(e) => setSkillId(e.target.value)}
          disabled={!subjectId}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">All skills / no specific skill</option>
          {skillsForSubject.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Creating…' : 'Create Session'}
      </button>
    </form>
  );
}
