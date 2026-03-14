'use client';

import { useEffect, useState, useCallback } from 'react';
import { SessionControls } from '@/components/teacher/SessionControls';
import { ResponseCounter } from '@/components/teacher/ResponseCounter';
import { ExplanationRecommender } from '@/components/teacher/ExplanationRecommender';
import { ClassHeatmap } from '@/components/teacher/ClassHeatmap';
import { StrugglingStudents } from '@/components/teacher/StrugglingStudents';

interface SkillState {
  skillId: string;
  masteryProbability: number;
  retrievalStrength: number;
  transferAbility: number;
  durabilityBand: 'AT_RISK' | 'DEVELOPING' | 'DURABLE';
}

interface Participant {
  studentId: string;
  name: string | null;
  email: string;
  isActive: boolean;
  joinedAt: string;
  skillStates: SkillState[];
  hasOpenFlag: boolean;
}

interface ResponseSummary {
  skillId: string;
  totalParticipants: number;
  answeredCount: number;
  correctCount: number;
}

interface RecommendedExplanation {
  explanationId: string;
  skillId: string;
  dle: number;
  routeType: string;
  misconceptionSummary: string;
  workedExample: string;
}

interface SkillMeta {
  id: string;
  code: string;
  name: string;
}

interface SessionState {
  sessionId: string;
  status: 'LOBBY' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  joinCode: string;
  startedAt: string | null;
  skillId: string | null;
  skill: SkillMeta | null;
  participants: Participant[];
  responseSummary: ResponseSummary[];
  recommendedExplanation: RecommendedExplanation | null;
}

interface Props {
  sessionId: string;
}

export function TeacherLiveDashboard({ sessionId }: Props) {
  const [state, setState] = useState<SessionState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/live-sessions/${sessionId}/state`);
      if (!res.ok) {
        setError('Failed to load session state.');
        return;
      }
      const data = await res.json();
      setState(data);
    } catch {
      setError('Network error.');
    }
  }, [sessionId]);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  useEffect(() => {
    if (!state || state.status !== 'ACTIVE') return;
    const id = setInterval(fetchState, 3000);
    return () => clearInterval(id);
  }, [state?.status, fetchState]);

  function handleStatusChange(newStatus: 'ACTIVE' | 'PAUSED' | 'COMPLETED') {
    setState((prev) => prev ? { ...prev, status: newStatus } : prev);
    fetchState();
  }

  if (error) {
    return <div className="p-8 text-red-600">{error}</div>;
  }

  if (!state) {
    return <div className="p-8 text-gray-500">Loading session…</div>;
  }

  const skills: SkillMeta[] = state.skill ? [state.skill] : [];

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
      <SessionControls
        sessionId={sessionId}
        status={state.status}
        joinCode={state.joinCode}
        startedAt={state.startedAt}
        participantCount={state.participants.length}
        onStatusChange={handleStatusChange}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Response Counters</h2>
          <ResponseCounter responseSummary={state.responseSummary} skills={skills} />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold text-gray-700">Explanation Recommender</h2>
          <ExplanationRecommender recommendedExplanation={state.recommendedExplanation} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Class Heatmap</h2>
        <ClassHeatmap participants={state.participants} skills={skills} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Struggling Students</h2>
        <StrugglingStudents participants={state.participants} skills={skills} />
      </div>
    </div>
  );
}
