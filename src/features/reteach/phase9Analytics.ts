import { prisma } from '@/db/prisma';

export async function getPhase9Analytics(subjectId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [assigned, gates, attempts] = await Promise.all([
    prisma.event.findMany({
      where: { name: 'reteach_path_assigned', subjectId, createdAt: { gte: since } },
      select: { payload: true, createdAt: true },
    }),
    prisma.event.findMany({
      where: { name: 'reteach_gate_evaluated', subjectId, createdAt: { gte: since } },
      select: { payload: true, createdAt: true },
    }),
    prisma.event.findMany({
      where: { name: 'reteach_attempt_recorded', subjectId, createdAt: { gte: since } },
      select: { payload: true, createdAt: true },
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

  gates.forEach((e) => {
    const payload = e.payload as { assignedPathId?: string; decision?: 'pass' | 'continue' | 'escalate' };
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
    }
    if (payload.decision === 'escalate') escalate += 1;
  });

  const decisions = pass + escalate;

  const avgAttemptsBeforePass =
    attemptsBeforePass.length > 0
      ? attemptsBeforePass.reduce((sum, n) => sum + n, 0) / attemptsBeforePass.length
      : null;

  const avgHoursToRecovery =
    hoursToRecovery.length > 0 ? hoursToRecovery.reduce((sum, n) => sum + n, 0) / hoursToRecovery.length : null;

  return {
    windowDays: days,
    loopsStarted: assigned.length,
    gateEvaluations: gates.length,
    passes: pass,
    escalations: escalate,
    recoveryRate: decisions > 0 ? pass / decisions : null,
    escalationRate: decisions > 0 ? escalate / decisions : null,
    avgAttemptsBeforePass,
    avgHoursToRecovery,
  };
}
