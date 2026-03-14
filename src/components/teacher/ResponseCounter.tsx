'use client';

interface ResponseSummary {
  skillId: string;
  totalParticipants: number;
  answeredCount: number;
  correctCount: number;
}

interface SkillMeta {
  id: string;
  code: string;
  name: string;
}

interface Props {
  responseSummary: ResponseSummary[];
  skills: SkillMeta[];
}

export function ResponseCounter({ responseSummary, skills }: Props) {
  if (skills.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
        No skills tracked yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {skills.map((skill) => {
        const summary = responseSummary.find((s) => s.skillId === skill.id);
        const total = summary?.totalParticipants ?? 0;
        const answered = summary?.answeredCount ?? 0;
        const correct = summary?.correctCount ?? 0;
        const incorrect = answered - correct;
        const pctAnswered = total > 0 ? Math.round((answered / total) * 100) : 0;
        const pctCorrect = answered > 0 ? Math.round((correct / answered) * 100) : 0;

        return (
          <div key={skill.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-800">
                {skill.code} — {skill.name}
              </span>
              <span className="text-xs text-gray-500">
                {answered} / {total} answered
              </span>
            </div>
            <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-blue-400"
                style={{ width: `${pctAnswered}%` }}
              />
            </div>
            {answered > 0 && (
              <div className="mt-1 flex h-2 w-full overflow-hidden rounded">
                <div
                  className="bg-green-400"
                  style={{ width: `${pctCorrect}%` }}
                  title={`${correct} correct`}
                />
                <div
                  className="bg-red-400"
                  style={{ width: `${100 - pctCorrect}%` }}
                  title={`${incorrect} incorrect`}
                />
              </div>
            )}
            {answered > 0 && (
              <div className="mt-1 text-xs text-gray-500">
                {correct} correct ({pctCorrect}%)
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
