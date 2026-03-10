import { describe, expect, it } from 'vitest';
import { decideNextQuestion, NEXT_QUESTION_POLICY_VERSION } from '@/features/knowledge-state/nextQuestionPolicy';
import type { KnowledgeState } from '@/features/knowledge-state/updateSkillState';

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

describe('knowledge-state/nextQuestionPolicy', () => {
  it('pins policy version', () => {
    expect(NEXT_QUESTION_POLICY_VERSION).toBe('v1');
  });

  it('chooses routine reinforcement at low mastery', () => {
    const next = decideNextQuestion({ state: baseState, now: new Date('2026-03-10T15:00:00.000Z') });

    expect(next.questionType).toBe('ROUTINE');
    expect(next.supportLevel).toBe('WORKED_EXAMPLE');
    expect(next.isTransferItem).toBe(false);
  });

  it('chooses retrieval when mastery is okay but retrieval is weak', () => {
    const next = decideNextQuestion({
      state: {
        ...baseState,
        masteryProbability: 0.62,
        retrievalStrength: 0.42,
        confidence: 0.4,
      },
    });

    expect(next.questionType).toBe('RETRIEVAL');
    expect(next.supportLevel).toBe('LIGHT_PROMPT');
  });

  it('chooses transfer when retrieval is stable but transfer is weak', () => {
    const next = decideNextQuestion({
      state: {
        ...baseState,
        masteryProbability: 0.7,
        retrievalStrength: 0.66,
        transferAbility: 0.3,
        confidence: 0.5,
      },
    });

    expect(next.questionType).toBe('TRANSFER');
    expect(next.isTransferItem).toBe(true);
  });

  it('marks review item when review is due', () => {
    const now = new Date('2026-03-10T15:00:00.000Z');
    const next = decideNextQuestion({
      state: {
        ...baseState,
        evidenceCount: 5,
        masteryProbability: 0.8,
        retrievalStrength: 0.75,
        transferAbility: 0.7,
        halfLifeDays: 2,
        lastAttemptAt: new Date('2026-03-05T15:00:00.000Z'),
      },
      now,
    });

    expect(next.isReviewItem).toBe(true);
    expect(next.questionType).toBe('RETRIEVAL');
  });
});
