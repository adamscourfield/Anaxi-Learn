import type { AttemptEvidenceSignals } from './scoreAttempt';

export interface KnowledgeState {
  masteryProbability: number;
  forgettingRate: number;
  halfLifeDays: number;
  retrievalStrength: number;
  transferAbility: number;
  confidence: number;
  evidenceCount: number;
  lastAttemptAt: Date | null;
  lastSuccessAt: Date | null;
  lastReviewAt: Date | null;
}

export interface KnowledgeStateAttemptContext {
  timestamp: Date;
  correct: boolean;
  isTransferItem: boolean;
  isReviewItem: boolean;
  expectedRetention?: number;
  observedRetention?: number;
}

export interface KnowledgeStateUpdateInput {
  state: KnowledgeState;
  evidence: AttemptEvidenceSignals;
  attempt: KnowledgeStateAttemptContext;
}

const MIN_FORGETTING_RATE = 0.001;
const LN2 = Math.log(2);

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

function masteryLearningRate(confidence: number): number {
  if (confidence < 0.4) return 0.22;
  if (confidence < 0.7) return 0.14;
  return 0.08;
}

function retrievalLearningRate(reliabilitySignal: number): number {
  return 0.18 * clamp01(reliabilitySignal);
}

function transferLearningRate(reliabilitySignal: number): number {
  return 0.2 * clamp01(reliabilitySignal);
}

function updateToward(current: number, signal: number, rate: number): number {
  return clamp01(current + rate * (signal - current));
}

function updateForgettingRate(
  forgettingRate: number,
  expectedRetention: number,
  observedRetention: number,
  gamma = 0.06
): number {
  const next = forgettingRate + gamma * (clamp01(expectedRetention) - clamp01(observedRetention));
  return Math.max(MIN_FORGETTING_RATE, next);
}

function updateConfidence(
  confidence: number,
  reliabilitySignal: number,
  consistencyFactor: number,
  evidenceCount: number,
  beta = 0.08
): number {
  const sampleBoost = Math.min(1, (evidenceCount + 1) / 20);
  const delta = beta * clamp01(reliabilitySignal) * clamp01(consistencyFactor) * sampleBoost;
  return clamp01(confidence + delta);
}

export function updateSkillState(input: KnowledgeStateUpdateInput): KnowledgeState {
  const { state, evidence, attempt } = input;

  const alpha = masteryLearningRate(state.confidence) * clamp01(evidence.reliabilitySignal);
  const delta = retrievalLearningRate(evidence.reliabilitySignal);
  const eta = transferLearningRate(evidence.reliabilitySignal);

  const masteryProbability = updateToward(state.masteryProbability, evidence.masterySignal, alpha);
  const retrievalStrength = updateToward(state.retrievalStrength, evidence.retrievalSignal, delta);

  const transferAbility = attempt.isTransferItem
    ? updateToward(state.transferAbility, evidence.transferSignal, eta)
    : state.transferAbility;

  const forgettingRate = attempt.isReviewItem
    ? updateForgettingRate(
        state.forgettingRate,
        attempt.expectedRetention ?? evidence.retrievalSignal,
        attempt.observedRetention ?? (attempt.correct ? 1 : 0)
      )
    : state.forgettingRate;

  const halfLifeDays = LN2 / Math.max(forgettingRate, MIN_FORGETTING_RATE);

  const confidence = updateConfidence(
    state.confidence,
    evidence.reliabilitySignal,
    evidence.consistencyFactor,
    state.evidenceCount
  );

  return {
    masteryProbability,
    forgettingRate,
    halfLifeDays,
    retrievalStrength,
    transferAbility,
    confidence,
    evidenceCount: state.evidenceCount + 1,
    lastAttemptAt: attempt.timestamp,
    lastSuccessAt: attempt.correct ? attempt.timestamp : state.lastSuccessAt,
    lastReviewAt: attempt.isReviewItem ? attempt.timestamp : state.lastReviewAt,
  };
}
