'use client';

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
  skillStates: SkillState[];
  hasOpenFlag: boolean;
}

interface SessionAttempt {
  studentUserId: string;
  skillId: string;
  correct: boolean;
}

interface SkillMeta {
  id: string;
  code: string;
  name: string;
}

interface Props {
  participants: Participant[];
  sessionAttempts?: SessionAttempt[];
  skills: SkillMeta[];
}

interface StrugglingStudent {
  studentId: string;
  name: string;
  skillGap: string;
  attempts: number;
  correct: number;
  accuracy: number;
  reason: string;
}

export function StrugglingStudents({ participants, sessionAttempts = [], skills }: Props) {
  const struggling: StrugglingStudent[] = [];

  for (const p of participants) {
    const myAttempts = sessionAttempts.filter((a) => a.studentUserId === p.studentId);
    const totalAttempts = myAttempts.length;
    const correctAttempts = myAttempts.filter((a) => a.correct).length;
    const accuracy = totalAttempts > 0 ? correctAttempts / totalAttempts : 0;

    const atRiskState = p.skillStates.find((s) => s.durabilityBand === 'AT_RISK');
    const isLowAccuracy = totalAttempts >= 3 && accuracy < 0.4;

    if (!atRiskState && !isLowAccuracy && !p.hasOpenFlag) continue;

    const skillName = atRiskState
      ? (skills.find((s) => s.id === atRiskState.skillId)?.code ?? 'Unknown skill')
      : (skills[0]?.code ?? 'Unknown skill');

    const reasons: string[] = [];
    if (atRiskState) reasons.push('AT_RISK band');
    if (isLowAccuracy) reasons.push(`<40% accuracy (${totalAttempts} attempts)`);
    if (p.hasOpenFlag) reasons.push('open intervention flag');

    struggling.push({
      studentId: p.studentId,
      name: p.name ?? p.email,
      skillGap: skillName,
      attempts: totalAttempts,
      correct: correctAttempts,
      accuracy,
      reason: reasons.join(', '),
    });
  }

  if (struggling.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
        No students currently flagged as struggling.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Student</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Skill gap</th>
            <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">Attempts</th>
            <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">Accuracy</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {struggling.map((s) => (
            <tr key={s.studentId} className="hover:bg-red-50">
              <td className="px-4 py-2 font-medium text-gray-800">{s.name}</td>
              <td className="px-4 py-2 text-gray-600">{s.skillGap}</td>
              <td className="px-4 py-2 text-center text-gray-600">{s.attempts}</td>
              <td className="px-4 py-2 text-center text-gray-600">
                {s.attempts > 0 ? `${Math.round(s.accuracy * 100)}%` : '—'}
              </td>
              <td className="px-4 py-2 text-red-600">{s.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
