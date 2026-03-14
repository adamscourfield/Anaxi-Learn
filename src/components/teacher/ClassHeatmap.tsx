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
  isActive: boolean;
  skillStates: SkillState[];
  hasOpenFlag: boolean;
}

interface SkillMeta {
  id: string;
  code: string;
  name: string;
}

interface Props {
  participants: Participant[];
  skills: SkillMeta[];
}

const bandClasses: Record<string, string> = {
  AT_RISK: 'bg-red-100 border border-red-300',
  DEVELOPING: 'bg-amber-100 border border-amber-300',
  DURABLE: 'bg-green-100 border border-green-300',
};

export function ClassHeatmap({ participants, skills }: Props) {
  if (participants.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        No students have joined yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full">
        <thead>
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Student</th>
            {skills.map((skill) => (
              <th key={skill.id} className="px-4 py-2 text-center text-xs font-semibold text-gray-600">
                {skill.code}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {participants.map((p) => (
            <tr
              key={p.studentId}
              className={p.hasOpenFlag ? 'bg-red-50' : 'hover:bg-gray-50'}
            >
              <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-gray-800">
                {p.name ?? p.email}
                {p.hasOpenFlag && (
                  <span className="ml-2 inline-block rounded bg-red-200 px-1 py-0.5 text-xs text-red-800">
                    ⚑
                  </span>
                )}
              </td>
              {skills.map((skill) => {
                const state = p.skillStates.find((s) => s.skillId === skill.id);
                const band = state?.durabilityBand;
                return (
                  <td key={skill.id} className="px-2 py-1 text-center">
                    <div className="group relative inline-block">
                      <div
                        className={`h-8 w-16 rounded ${band ? bandClasses[band] : 'bg-gray-100 border border-gray-200'}`}
                      />
                      {state && (
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-44 -translate-x-1/2 rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block">
                          <div>Mastery: {Math.round(state.masteryProbability * 100)}%</div>
                          <div>Retrieval: {Math.round(state.retrievalStrength * 100)}%</div>
                          <div>Transfer: {Math.round(state.transferAbility * 100)}%</div>
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
