import { prisma } from '@/db/prisma';
import { RETEACH_CONFIG } from './reteachConfig';

export type ReteachReasonCode =
  | 'LOW_CHECKPOINT_ACCURACY'
  | 'HIGH_WRONG_FIRST_DIFF'
  | 'LOW_INTERACTION_PASS'
  | 'NEGATIVE_DLE_TREND'
  | 'REPEATED_CONCEPT_FAILURE';

export type ReteachLoopStep = 'TEACH' | 'GUIDED' | 'INDEPENDENT' | 'RETRIEVAL';
export type GateDecision = 'pass' | 'continue' | 'escalate';

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

export function inferReasonCodes(input: RouteInput): ReteachReasonCode[] {
  const reasons: ReteachReasonCode[] = [];
  if (clamp01(input.checkpointAccuracy, 1) < RETEACH_CONFIG.checkpointAccuracyTrigger) reasons.push('LOW_CHECKPOINT_ACCURACY');
  if (clamp01(input.wrongFirstDifferenceRate, 0) > RETEACH_CONFIG.wrongFirstDifferenceTrigger) reasons.push('HIGH_WRONG_FIRST_DIFF');
  if (clamp01(input.interactionPassRate, 1) < RETEACH_CONFIG.interactionPassTrigger) reasons.push('LOW_INTERACTION_PASS');
  if ((input.dleTrend ?? 0) < RETEACH_CONFIG.dleTrendTrigger) reasons.push('NEGATIVE_DLE_TREND');
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
  const reasonCodes = inferReasonCodes(input);
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
  supportLevel?: 'INDEPENDENT' | 'LIGHT_PROMPT' | 'WORKED_EXAMPLE' | 'SCAFFOLDED' | 'FULL_EXPLANATION';
  isDelayedRetrieval?: boolean;
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
      },
    },
  });
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

  const parsed = attempts.map((event) => {
    const payload = (event.payload ?? {}) as {
      correct?: boolean;
      supportLevel?: string;
      isDelayedRetrieval?: boolean;
      step?: ReteachLoopStep;
    };
    return {
      correct: payload.correct === true,
      supportLevel: payload.supportLevel ?? 'INDEPENDENT',
      isDelayedRetrieval: payload.isDelayedRetrieval === true,
      step: payload.step,
    };
  });

  const independent = parsed.filter((a) => a.supportLevel === 'INDEPENDENT');
  const independentWindow = Math.max(1, Math.round(RETEACH_CONFIG.gateIndependentRateWindow));
  const independentWindowed = independent.slice(-independentWindow);
  const independentCorrectRate =
    independentWindowed.length === 0
      ? 0
      : independentWindowed.filter((a) => a.correct).length / independentWindowed.length;

  let consecutiveIndependentCorrect = 0;
  for (let i = independent.length - 1; i >= 0; i -= 1) {
    if (independent[i].correct) consecutiveIndependentCorrect += 1;
    else break;
  }

  const delayedChecks = parsed.filter((a) => a.isDelayedRetrieval);
  const delayedRetrievalOk = delayedChecks.length === 0 || delayedChecks.slice(-1)[0].correct;

  const failedLoops = await getRecentFailedLoops(input.userId, input.subjectId, input.skillId);

  let decision: GateDecision = 'continue';
  if (
    consecutiveIndependentCorrect >= Math.max(1, Math.round(RETEACH_CONFIG.gateConsecutiveIndependentCorrect)) &&
    independentCorrectRate >= RETEACH_CONFIG.gateIndependentRateMin &&
    delayedRetrievalOk
  ) {
    decision = 'pass';
  } else if (failedLoops >= Math.max(1, Math.round(RETEACH_CONFIG.gateEscalateAfterFailedLoops))) {
    decision = 'escalate';
  }

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
          consecutiveIndependentCorrect,
          independentCorrectRate,
          delayedRetrievalOk,
        },
      },
    },
  });

  return {
    decision,
    checks: {
      consecutiveIndependentCorrect,
      independentCorrectRate,
      delayedRetrievalOk,
    },
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
