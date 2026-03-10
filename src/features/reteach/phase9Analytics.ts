import { prisma } from '@/db/prisma';

type GateDecision = 'pass' | 'continue' | 'escalate';

type SuggestionCode =
  | 'RUN_WORKED_EXAMPLE_1TO1'
  | 'ASSIGN_SHORT_RETRIEVAL_SET'
  | 'CHECK_FOUNDATION_PREREQUISITE'
  | 'REDUCE_SCAFFOLD_GRADUALLY'
  | 'UNKNOWN';

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

export async function getPhase9Analytics(subjectId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [assigned, gates, attempts, escalations] = await Promise.all([
    prisma.event.findMany({
      where: { name: 'reteach_path_assigned', subjectId, createdAt: { gte: since } },
      select: { payload: true, createdAt: true },
    }),
    prisma.event.findMany({
      where: { name: 'reteach_gate_evaluated', subjectId, createdAt: { gte: since } },
      select: { payload: true, createdAt: true, studentUserId: true, skillId: true },
    }),
    prisma.event.findMany({
      where: { name: 'reteach_attempt_recorded', subjectId, createdAt: { gte: since } },
      select: { payload: true, createdAt: true },
    }),
    prisma.event.findMany({
      where: { name: 'reteach_escalated', subjectId, createdAt: { gte: since } },
      select: { payload: true, createdAt: true, studentUserId: true, skillId: true },
    }),
  ]);

  const assignedMap = new Map<string, Date>();
  assigned.forEach((e) => {
    const payload = e.payload as { assignedPathId?: string };
    if (payload.assignedPathId) assignedMap.set(payload.assignedPathId, e.createdAt);
  });

  const attemptCounts = new Map<string, number>();
  attempts.forEach((e) => {
    const payload = e.payload as { assignedPathId?: string };
    if (!payload.assignedPathId) return;
    attemptCounts.set(payload.assignedPathId, (attemptCounts.get(payload.assignedPathId) ?? 0) + 1);
  });

  let pass = 0;
  let escalate = 0;
  const attemptsBeforePass: number[] = [];
  const hoursToRecovery: number[] = [];

  const decisionReasonCounts = new Map<string, number>();
  const gatePassByLearnerSkill = new Map<string, Date[]>();

  gates.forEach((e) => {
    const payload = e.payload as {
      assignedPathId?: string;
      decision?: GateDecision;
      decisionTrace?: { decisionReason?: string };
    };

    const decisionReason = payload.decisionTrace?.decisionReason ?? 'unknown';
    decisionReasonCounts.set(decisionReason, (decisionReasonCounts.get(decisionReason) ?? 0) + 1);

    if (payload.decision === 'pass') {
      pass += 1;
      if (payload.assignedPathId) {
        const attemptsForPath = attemptCounts.get(payload.assignedPathId);
        if (typeof attemptsForPath === 'number') attemptsBeforePass.push(attemptsForPath);

        const startedAt = assignedMap.get(payload.assignedPathId);
        if (startedAt) {
          const hours = (e.createdAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60);
          if (hours >= 0) hoursToRecovery.push(hours);
        }
      }

      if (e.studentUserId && e.skillId) {
        const key = `${e.studentUserId}::${e.skillId}`;
        const list = gatePassByLearnerSkill.get(key) ?? [];
        list.push(e.createdAt);
        gatePassByLearnerSkill.set(key, list);
      }
    }

    if (payload.decision === 'escalate') escalate += 1;
  });

  const escalationReasonCounts = new Map<string, number>();
  const suggestionStats = new Map<SuggestionCode, { assigned: number; recovered: number }>();

  escalations.forEach((e) => {
    const payload = e.payload as {
      reasonCode?: string;
      interventionSuggestions?: Array<{ code?: string }>;
    };

    const reasonCode = payload.reasonCode ?? 'unknown';
    escalationReasonCounts.set(reasonCode, (escalationReasonCounts.get(reasonCode) ?? 0) + 1);

    const suggestionCodes = new Set<SuggestionCode>(
      (payload.interventionSuggestions ?? [])
        .map((s) => (s?.code ? (s.code as SuggestionCode) : 'UNKNOWN'))
        .filter(Boolean)
    );

    if (suggestionCodes.size === 0) suggestionCodes.add('UNKNOWN');

    const learnerSkillKey = e.studentUserId && e.skillId ? `${e.studentUserId}::${e.skillId}` : null;
    const laterPasses = learnerSkillKey ? gatePassByLearnerSkill.get(learnerSkillKey) ?? [] : [];
    const recoveredAfterEscalation = laterPasses.some((passTime) => passTime.getTime() > e.createdAt.getTime());

    suggestionCodes.forEach((code) => {
      const current = suggestionStats.get(code) ?? { assigned: 0, recovered: 0 };
      current.assigned += 1;
      if (recoveredAfterEscalation) current.recovered += 1;
      suggestionStats.set(code, current);
    });
  });

  const decisions = pass + escalate;

  const decisionReasonDistribution = Array.from(decisionReasonCounts.entries())
    .map(([reasonCode, count]) => ({
      reasonCode,
      count,
      share: gates.length > 0 ? count / gates.length : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const escalationReasonDistribution = Array.from(escalationReasonCounts.entries())
    .map(([reasonCode, count]) => ({
      reasonCode,
      count,
      share: escalations.length > 0 ? count / escalations.length : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const suggestionEffectiveness = Array.from(suggestionStats.entries())
    .map(([suggestionCode, stats]) => ({
      suggestionCode,
      assignedCount: stats.assigned,
      recoveredCount: stats.recovered,
      recoveryRate: stats.assigned > 0 ? stats.recovered / stats.assigned : null,
    }))
    .sort((a, b) => b.assignedCount - a.assignedCount);

  return {
    windowDays: days,
    loopsStarted: assigned.length,
    gateEvaluations: gates.length,
    passes: pass,
    escalations: escalate,
    recoveryRate: decisions > 0 ? pass / decisions : null,
    escalationRate: decisions > 0 ? escalate / decisions : null,
    avgAttemptsBeforePass: avg(attemptsBeforePass),
    avgHoursToRecovery: avg(hoursToRecovery),
    decisionReasonDistribution,
    escalationReasonDistribution,
    suggestionEffectiveness,
  };
}
