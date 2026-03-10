import { describe, expect, it } from 'vitest';
import {
  clamp01,
  computeDLE,
  computeInstructionalTimeMs,
  computeKnowledgeStability,
  computeLearningGain,
  getDurabilityBand,
} from '@/features/knowledge-state/dle';
import type { KnowledgeState } from '@/features/knowledge-state/updateSkillState';

const baseState: KnowledgeState = {
  masteryProbability: 0.4,
  forgettingRate: 0.12,
  halfLifeDays: 6,
  retrievalStrength: 0.35,
  transferAbility: 0.25,
  confidence: 0.2,
  evidenceCount: 10,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastReviewAt: null,
};

describe('knowledge-state dle helpers', () => {
  it('clamps to [0,1]', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.42)).toBe(0.42);
  });

  it('computes positive learning gain only when state improves', () => {
    const better: KnowledgeState = { ...baseState, masteryProbability: 0.5, retrievalStrength: 0.45, transferAbility: 0.3 };
    const worse: KnowledgeState = { ...baseState, masteryProbability: 0.3, retrievalStrength: 0.2, transferAbility: 0.1 };

    expect(computeLearningGain(baseState, better)).toBeGreaterThan(0);
    expect(computeLearningGain(baseState, worse)).toBe(0);
  });

  it('computes stability from retrieval/transfer/forgetting/confidence', () => {
    const stable = computeKnowledgeStability({ ...baseState, retrievalStrength: 0.7, transferAbility: 0.6, forgettingRate: 0.05, confidence: 0.8 });
    const unstable = computeKnowledgeStability({ ...baseState, retrievalStrength: 0.2, transferAbility: 0.1, forgettingRate: 0.25, confidence: 0.1 });

    expect(stable).toBeGreaterThan(unstable);
  });

  it('computes instructional time with hint/explanation penalties', () => {
    expect(computeInstructionalTimeMs({ responseTimeMs: 5000 })).toBe(5000);
    expect(computeInstructionalTimeMs({ responseTimeMs: 5000, hintsUsed: 2 })).toBe(15000);
    expect(computeInstructionalTimeMs({ responseTimeMs: 5000, hintsUsed: 1, explanationId: 'exp1' })).toBe(25000);
  });

  it('assigns durability bands from DLE score', () => {
    expect(getDurabilityBand(0.1)).toBe('AT_RISK');
    expect(getDurabilityBand(0.3)).toBe('DEVELOPING');
    expect(getDurabilityBand(0.6)).toBe('DURABLE');
  });

  it('computes DLE v1 payload', () => {
    const dle = computeDLE({ learningGain: 0.4, knowledgeStability: 0.8, instructionalTimeMs: 60000 });
    expect(dle.version).toBe('v1');
    expect(dle.value).toBeCloseTo(0.32, 5);
    expect(dle.durabilityBand).toBe('DEVELOPING');
  });
});
