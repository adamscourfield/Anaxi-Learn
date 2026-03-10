import { describe, expect, it } from 'vitest';
import { updateSkillState, type KnowledgeState } from '@/features/knowledge-state/updateSkillState';

const baseState: KnowledgeState = {
  masteryProbability: 0.35,
  forgettingRate: 0.12,
  halfLifeDays: Math.log(2) / 0.12,
  retrievalStrength: 0.3,
  transferAbility: 0.2,
  confidence: 0.1,
  evidenceCount: 0,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastReviewAt: null,
};

describe('knowledge-state/updateSkillState', () => {
  it('updates mastery and retrieval toward evidence signals', () => {
    const now = new Date('2026-03-10T15:00:00.000Z');

    const next = updateSkillState({
      state: baseState,
      evidence: {
        masterySignal: 0.95,
        retrievalSignal: 0.95,
        transferSignal: 0.8,
        forgettingSignal: 0.5,
        reliabilitySignal: 0.9,
        consistencyFactor: 0.8,
      },
      attempt: {
        timestamp: now,
        correct: true,
        isTransferItem: false,
        isReviewItem: false,
      },
    });

    expect(next.masteryProbability).toBeGreaterThan(baseState.masteryProbability);
    expect(next.retrievalStrength).toBeGreaterThan(baseState.retrievalStrength);
    expect(next.evidenceCount).toBe(1);
    expect(next.lastAttemptAt?.toISOString()).toBe(now.toISOString());
    expect(next.lastSuccessAt?.toISOString()).toBe(now.toISOString());
  });

  it('updates transfer only on transfer-relevant attempts', () => {
    const now = new Date('2026-03-10T15:00:00.000Z');

    const noTransfer = updateSkillState({
      state: baseState,
      evidence: {
        masterySignal: 0.8,
        retrievalSignal: 0.75,
        transferSignal: 0.95,
        forgettingSignal: 0.5,
        reliabilitySignal: 0.8,
        consistencyFactor: 0.8,
      },
      attempt: {
        timestamp: now,
        correct: true,
        isTransferItem: false,
        isReviewItem: false,
      },
    });

    const transfer = updateSkillState({
      state: baseState,
      evidence: {
        masterySignal: 0.8,
        retrievalSignal: 0.75,
        transferSignal: 0.95,
        forgettingSignal: 0.5,
        reliabilitySignal: 0.8,
        consistencyFactor: 0.8,
      },
      attempt: {
        timestamp: now,
        correct: true,
        isTransferItem: true,
        isReviewItem: false,
      },
    });

    expect(noTransfer.transferAbility).toBe(baseState.transferAbility);
    expect(transfer.transferAbility).toBeGreaterThan(baseState.transferAbility);
  });

  it('updates forgetting rate and half-life on review attempts', () => {
    const now = new Date('2026-03-10T15:00:00.000Z');

    const next = updateSkillState({
      state: baseState,
      evidence: {
        masterySignal: 0.65,
        retrievalSignal: 0.45,
        transferSignal: 0.5,
        forgettingSignal: 0.3,
        reliabilitySignal: 0.65,
        consistencyFactor: 0.7,
      },
      attempt: {
        timestamp: now,
        correct: false,
        isTransferItem: false,
        isReviewItem: true,
        expectedRetention: 0.8,
        observedRetention: 0.3,
      },
    });

    expect(next.forgettingRate).toBeGreaterThan(baseState.forgettingRate);
    expect(next.halfLifeDays).toBeLessThan(baseState.halfLifeDays);
    expect(next.lastReviewAt?.toISOString()).toBe(now.toISOString());
  });

  it('increases confidence gradually with reliable consistent evidence', () => {
    const now = new Date('2026-03-10T15:00:00.000Z');

    const next = updateSkillState({
      state: baseState,
      evidence: {
        masterySignal: 0.95,
        retrievalSignal: 0.95,
        transferSignal: 0.8,
        forgettingSignal: 0.5,
        reliabilitySignal: 0.9,
        consistencyFactor: 0.9,
      },
      attempt: {
        timestamp: now,
        correct: true,
        isTransferItem: false,
        isReviewItem: false,
      },
    });

    expect(next.confidence).toBeGreaterThan(baseState.confidence);
    expect(next.confidence).toBeLessThan(0.2);
  });
});
