import type { KnowledgeState } from './updateSkillState';

export type DurabilityBand = 'AT_RISK' | 'DEVELOPING' | 'DURABLE';

export interface DLEInput {
  learningGain: number;
  knowledgeStability: number;
  instructionalTimeMs: number;
}

export interface DLEBreakdown extends DLEInput {
  value: number;
  durabilityBand: DurabilityBand;
  version: 'v1';
}

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export function computeLearningGain(previous: KnowledgeState, next: KnowledgeState): number {
  const masteryGain = Math.max(0, next.masteryProbability - previous.masteryProbability);
  const retrievalGain = Math.max(0, next.retrievalStrength - previous.retrievalStrength);
  const transferGain = Math.max(0, next.transferAbility - previous.transferAbility);
  return clamp01(masteryGain * 0.4 + retrievalGain * 0.35 + transferGain * 0.25);
}

export function computeKnowledgeStability(state: KnowledgeState): number {
  const forgettingPenalty = clamp01(1 - state.forgettingRate * 4);
  const base = state.retrievalStrength * 0.45 + state.transferAbility * 0.3 + forgettingPenalty * 0.25;
  return clamp01(base * (0.7 + state.confidence * 0.3));
}

export function computeInstructionalTimeMs(params: {
  responseTimeMs?: number;
  hintsUsed?: number;
  explanationId?: string;
}): number {
  const responseMs = Math.max(1000, params.responseTimeMs ?? 12000);
  const hintPenaltyMs = (params.hintsUsed ?? 0) * 5000;
  const explanationPenaltyMs = params.explanationId ? 15000 : 0;
  return responseMs + hintPenaltyMs + explanationPenaltyMs;
}

export function getDurabilityBand(value: number): DurabilityBand {
  if (value >= 0.55) return 'DURABLE';
  if (value >= 0.25) return 'DEVELOPING';
  return 'AT_RISK';
}

export function computeDLE({ learningGain, knowledgeStability, instructionalTimeMs }: DLEInput): DLEBreakdown {
  const normalisedTimeMinutes = Math.max(1, instructionalTimeMs / 60000);
  const value = clamp01((learningGain * knowledgeStability) / normalisedTimeMinutes);
  return {
    value,
    learningGain,
    knowledgeStability,
    instructionalTimeMs,
    durabilityBand: getDurabilityBand(value),
    version: 'v1',
  };
}
