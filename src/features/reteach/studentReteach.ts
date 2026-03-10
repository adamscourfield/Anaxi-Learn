import { prisma } from '@/db/prisma';
import { getEffectiveReteachConfig, type EffectiveReteachConfig } from './reteachPolicy';

export type ReteachReasonCode =
  | 'LOW_CHECKPOINT_ACCURACY'
  | 'HIGH_WRONG_FIRST_DIFF'
  | 'LOW_INTERACTION_PASS'
  | 'NEGATIVE_DLE_TREND'
  | 'REPEATED_CONCEPT_FAILURE';

export type ReteachLoopStep = 'TEACH' | 'GUIDED' | 'INDEPENDENT' | 'RETRIEVAL';
export type GateDecision = 'pass' | 'continue' | 'escalate';

type SupportLevel = 'INDEPENDENT' | 'LIGHT_PROMPT' | 'WORKED_EXAMPLE' | 'SCAFFOLDED' | 'FULL_EXPLANATION';

type ParsedAttempt = {
  correct: boolean;
  supportLevel: SupportLevel;
  isDelayedRetrieval: boolean;
  step?: ReteachLoopStep;
  responseTimeMs?: number;
};

export interface RouteInput {
  userId: string;
  subjectId: string;
  skillId: string;
  routeType: 'A' | 'B' | 'C';
  checkpointAccuracy?: number;
  wrongFirstDifferenceRate?: number;
  interactionPassRate?: number;
  dleTrend?: number;
}

function clamp01(value: number | undefined, fallback = 0): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function rateCorrect(items: Array<{ correct: boolean }>): number {
  if (items.length === 0) return 0;
  return items.filter((x) => x.correct).length / items.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function classifyResponseTimeBand(ms: number | null): 'fast' | 'balanced' | 'slow' | 'unknown' {
  if (ms == null) return 'unknown';
  if (ms < 8000) return 'fast';
  if (ms <= 35000) return 'balanced';
  return 'slow';
}

function computeCorrectnessTrendDelta(parsed: ParsedAttempt[]): number {
  const recent = parsed.slice(-3);
  const prior = parsed.slice(Math.max(0, parsed.length - 6), Math.max(0, parsed.length - 3));
  const recentRate = rateCorrect(recent);
  const priorRate = rateCorrect(prior);
  return recentRate - priorRate;
}

export function inferReasonCodes(input: RouteInput, config: EffectiveReteachConfig): ReteachReasonCode[] {
  const reasons: ReteachReasonCode[] = [];
  if (clamp01(input.checkpointAccuracy, 1) < config.checkpointAccuracyTrigger) reasons.push('LOW_CHECKPOINT_ACCURACY');
  if (clamp01(input.wrongFirstDifferenceRate, 0) > config.wrongFirstDifferenceTrigger) reasons.push('HIGH_WRONG_FIRST_DIFF');
  if (clamp01(input.interactionPassRate, 1) < config.interactionPassTrigger) reasons.push('LOW_INTERACTION_PASS');
  if ((input.dleTrend ?? 0) < config.dleTrendTrigger) reasons.push('NEGATIVE_DLE_TREND');
  return reasons;
}

export async function getRecentFailedLoops(userId: string, subjectId: string, skillId: string, lookbackDays = 14) {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  return prisma.event.count({
    where: {
      name: 'reteach_gate_evaluated',
      studentUserId: userId,
      subjectId,
      skillId,
      createdAt: { gte: since },
      payload: {
        path: ['decision'],
        equals: 'escalate',
      },
    },
  });
}

export async function createReteachRoute(input: RouteInput) {
  const config = await getEffectiveReteachConfig();
  const reasonCodes = inferReasonCodes(input, config);
  const failedLoops = await getRecentFailedLoops(input.userId, input.subjectId, input.skillId);
  if (failedLoops >= 1 && !reasonCodes.includes('REPEATED_CONCEPT_FAILURE')) {
    reasonCodes.push('REPEATED_CONCEPT_FAILURE');
  }

  const assignedPathId = `p9-${input.skillId}-${Date.now().toString(36)}`;
  const startedAt = new Date();

  await prisma.event.create({
    data: {
      name: 'reteach_path_assigned',
      actorUserId: input.userId,
      studentUserId: input.userId,
      subjectId: input.subjectId,
      skillId: input.skillId,
      payload: {
        assignedPathId,
        routeType: input.routeType,
        reasonCodes,
        step: 'TEACH',
        stepIndex: 0,
        startedAt: startedAt.toISOString(),
      },
    },
  });

  return {
    assignedPathId,
    reasonCodes,
    difficultyStart: input.routeType,
    step: 'TEACH' as const,
    stepIndex: 0,
  };
}

export interface AttemptRecordInput {
  userId: string;
  subjectId: string;
  skillId: string;
  assignedPathId: string;
  step: ReteachLoopStep;
  stepIndex: number;
  correct: boolean;
  supportLevel?: SupportLevel;
  isDelayedRetrieval?: boolean;
  responseTimeMs?: number;
}

export async function recordReteachAttempt(input: AttemptRecordInput) {
  await prisma.event.create({
    data: {
      name: 'reteach_attempt_recorded',
      actorUserId: input.userId,
      studentUserId: input.userId,
      subjectId: input.subjectId,
      skillId: input.skillId,
      payload: {
        assignedPathId: input.assignedPathId,
        step: input.step,
        stepIndex: input.stepIndex,
        correct: input.correct,
        supportLevel: input.supportLevel ?? 'INDEPENDENT',
        isDelayedRetrieval: input.isDelayedRetrieval ?? false,
        responseTimeMs: typeof input.responseTimeMs === 'number' ? Math.max(0, Math.round(input.responseTimeMs)) : null,
      },
    },
  });
}

function buildGateMetrics(parsed: ParsedAttempt[], config: EffectiveReteachConfig, failedLoops: number) {
  const independent = parsed.filter((a) => a.supportLevel === 'INDEPENDENT');
  const independentWindow = Math.max(1, Math.round(config.gateIndependentRateWindow));
  const independentWindowed = independent.slice(-independentWindow);
  const independentCorrectRate = rateCorrect(independentWindowed);

  let consecutiveIndependentCorrect = 0;
  for (let i = independent.length - 1; i >= 0; i -= 1) {
    if (independent[i].correct) consecutiveIndependentCorrect += 1;
    else break;
  }

  const delayedChecks = parsed.filter((a) => a.isDelayedRetrieval);
  const delayedRetrievalOk = delayedChecks.length === 0 || delayedChecks.slice(-1)[0].correct;

  const attemptsUsed = parsed.length;
  const hintRelianceRate = parsed.length === 0 ? 0 : parsed.filter((a) => a.supportLevel !== 'INDEPENDENT').length / parsed.length;
  const correctnessTrendDelta = computeCorrectnessTrendDelta(parsed);
  const medianResponseTimeMs = median(parsed.map((a) => a.responseTimeMs).filter((v): v is number => typeof v === 'number' && Number.isFinite(v)));
  const responseTimeBand = classifyResponseTimeBand(medianResponseTimeMs);

  return {
    consecutiveIndependentCorrect,
    independentCorrectRate,
    delayedRetrievalOk,
    attemptsUsed,
    hintRelianceRate,
    correctnessTrendDelta,
    medianResponseTimeMs,
    responseTimeBand,
    failedLoops,
  };
}

export async function evaluateGate(input: {
  userId: string;
  subjectId: string;
  skillId: string;
  assignedPathId: string;
}) {
  const attempts = await prisma.event.findMany({
    where: {
      name: 'reteach_attempt_recorded',
      studentUserId: input.userId,
      subjectId: input.subjectId,
      skillId: input.skillId,
      payload: { path: ['assignedPathId'], equals: input.assignedPathId },
    },
    orderBy: { createdAt: 'asc' },
    select: { payload: true, createdAt: true },
  });

  const parsed: ParsedAttempt[] = attempts.map((event) => {
    const payload = (event.payload ?? {}) as {
      correct?: boolean;
      supportLevel?: string;
      isDelayedRetrieval?: boolean;
      step?: ReteachLoopStep;
      responseTimeMs?: number | null;
    };
    return {
      correct: payload.correct === true,
      supportLevel: (payload.supportLevel as SupportLevel) ?? 'INDEPENDENT',
      isDelayedRetrieval: payload.isDelayedRetrieval === true,
      step: payload.step,
      responseTimeMs: typeof payload.responseTimeMs === 'number' ? payload.responseTimeMs : undefined,
    };
  });

  const config = await getEffectiveReteachConfig();
  const failedLoops = await getRecentFailedLoops(input.userId, input.subjectId, input.skillId);
  const metrics = buildGateMetrics(parsed, config, failedLoops);

  const rules = {
    masteryGateMet:
      metrics.consecutiveIndependentCorrect >= Math.max(1, Math.round(config.gateConsecutiveIndependentCorrect)) &&
      metrics.independentCorrectRate >= config.gateIndependentRateMin &&
      metrics.delayedRetrievalOk,
    lowHintReliance: metrics.hintRelianceRate <= 0.7,
    attemptsWithinBudget: metrics.attemptsUsed <= 10,
    trendIsRecovering: metrics.correctnessTrendDelta >= 0,
    hardEscalationByHistory: metrics.failedLoops >= Math.max(1, Math.round(config.gateEscalateAfterFailedLoops)),
    hardEscalationByAttempts: metrics.attemptsUsed >= 12,
    hardEscalationByDependence: metrics.hintRelianceRate > 0.85 && metrics.correctnessTrendDelta <= 0,
  };

  let decision: GateDecision = 'continue';
  let decisionReason = 'insufficient_evidence';

  if (config.policyVersion === 'v2') {
    if (rules.masteryGateMet && rules.lowHintReliance && rules.attemptsWithinBudget) {
      decision = 'pass';
      decisionReason = 'mastery_with_independence';
    } else if (rules.hardEscalationByHistory || rules.hardEscalationByAttempts || rules.hardEscalationByDependence) {
      decision = 'escalate';
      decisionReason = rules.hardEscalationByHistory
        ? 'repeated_failed_loops'
        : rules.hardEscalationByAttempts
          ? 'attempt_budget_exhausted'
          : 'high_hint_dependence_without_recovery';
    } else if (rules.masteryGateMet && !rules.lowHintReliance) {
      decision = 'continue';
      decisionReason = 'needs_more_independent_success';
    } else if (rules.trendIsRecovering) {
      decision = 'continue';
      decisionReason = 'recovering_keep_looping';
    }
  } else {
    if (rules.masteryGateMet) {
      decision = 'pass';
      decisionReason = 'v1_mastery_gate_met';
    } else if (rules.hardEscalationByHistory) {
      decision = 'escalate';
      decisionReason = 'v1_repeated_failed_loops';
    }
  }

  const decisionTrace = {
    policyVersion: config.policyVersion,
    signals: {
      attemptsUsed: metrics.attemptsUsed,
      hintRelianceRate: Number(metrics.hintRelianceRate.toFixed(3)),
      correctnessTrendDelta: Number(metrics.correctnessTrendDelta.toFixed(3)),
      medianResponseTimeMs: metrics.medianResponseTimeMs,
      responseTimeBand: metrics.responseTimeBand,
      failedLoops: metrics.failedLoops,
    },
    checks: {
      consecutiveIndependentCorrect: metrics.consecutiveIndependentCorrect,
      independentCorrectRate: Number(metrics.independentCorrectRate.toFixed(3)),
      delayedRetrievalOk: metrics.delayedRetrievalOk,
    },
    rules,
    decisionReason,
  };

  await prisma.event.create({
    data: {
      name: 'reteach_gate_evaluated',
      actorUserId: input.userId,
      studentUserId: input.userId,
      subjectId: input.subjectId,
      skillId: input.skillId,
      payload: {
        assignedPathId: input.assignedPathId,
        decision,
        checks: {
          consecutiveIndependentCorrect: metrics.consecutiveIndependentCorrect,
          independentCorrectRate: metrics.independentCorrectRate,
          delayedRetrievalOk: metrics.delayedRetrievalOk,
        },
        decisionTrace,
      },
    },
  });

  return {
    decision,
    checks: {
      consecutiveIndependentCorrect: metrics.consecutiveIndependentCorrect,
      independentCorrectRate: metrics.independentCorrectRate,
      delayedRetrievalOk: metrics.delayedRetrievalOk,
    },
    decisionTrace,
  };
}

export async function escalateReteach(input: {
  userId: string;
  subjectId: string;
  skillId: string;
  assignedPathId: string;
  reason: string;
}) {
  await prisma.$transaction([
    prisma.interventionFlag.upsert({
      where: { userId_skillId: { userId: input.userId, skillId: input.skillId } },
      update: {
        isResolved: false,
        reason: input.reason,
        lastSeenAt: new Date(),
      },
      create: {
        userId: input.userId,
        subjectId: input.subjectId,
        skillId: input.skillId,
        reason: input.reason,
        isResolved: false,
      },
    }),
    prisma.event.create({
      data: {
        name: 'reteach_escalated',
        actorUserId: input.userId,
        studentUserId: input.userId,
        subjectId: input.subjectId,
        skillId: input.skillId,
        payload: {
          assignedPathId: input.assignedPathId,
          reason: input.reason,
        },
      },
    }),
  ]);
}

export async function getReteachState(input: {
  userId: string;
  subjectId: string;
  skillId: string;
  assignedPathId: string;
}) {
  const [assignment, attempts, gate] = await Promise.all([
    prisma.event.findFirst({
      where: {
        name: 'reteach_path_assigned',
        studentUserId: input.userId,
        subjectId: input.subjectId,
        skillId: input.skillId,
        payload: { path: ['assignedPathId'], equals: input.assignedPathId },
      },
      orderBy: { createdAt: 'desc' },
      select: { payload: true, createdAt: true },
    }),
    prisma.event.findMany({
      where: {
        name: 'reteach_attempt_recorded',
        studentUserId: input.userId,
        subjectId: input.subjectId,
        skillId: input.skillId,
        payload: { path: ['assignedPathId'], equals: input.assignedPathId },
      },
      orderBy: { createdAt: 'asc' },
      select: { payload: true, createdAt: true },
    }),
    prisma.event.findFirst({
      where: {
        name: 'reteach_gate_evaluated',
        studentUserId: input.userId,
        subjectId: input.subjectId,
        skillId: input.skillId,
        payload: { path: ['assignedPathId'], equals: input.assignedPathId },
      },
      orderBy: { createdAt: 'desc' },
      select: { payload: true, createdAt: true },
    }),
  ]);

  return {
    assignedPathId: input.assignedPathId,
    assignment: assignment?.payload ?? null,
    attempts: attempts.map((a) => ({ payload: a.payload, createdAt: a.createdAt })),
    latestGate: gate?.payload ?? null,
  };
}
