import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_SCORING_VERSION, scoreAttempt } from '@/features/knowledge-state/scoreAttempt';

describe('knowledge-state/scoreAttempt', () => {
  it('exposes a fixed scoring version for auditability', () => {
    expect(KNOWLEDGE_SCORING_VERSION).toBe('v1');
  });

  it('scores case A: correct + fast + independent + no hints', () => {
    const evidence = scoreAttempt({
      correct: true,
      responseTimeMs: 4000,
      hintsUsed: 0,
      supportLevel: 'INDEPENDENT',
      questionType: 'ROUTINE',
      isTransferItem: false,
      isMixedItem: false,
      isReviewItem: false,
    });

    expect(evidence.masterySignal).toBeCloseTo(0.95);
    expect(evidence.retrievalSignal).toBeCloseTo(0.95);
    expect(evidence.reliabilitySignal).toBeCloseTo(0.9);
  });

  it('scores case C style outcomes for slow/hinted correct responses', () => {
    const evidence = scoreAttempt({
      correct: true,
      responseTimeMs: 22000,
      hintsUsed: 1,
      supportLevel: 'LIGHT_PROMPT',
      questionType: 'ROUTINE',
      isTransferItem: false,
      isMixedItem: false,
      isReviewItem: false,
    });

    expect(evidence.masterySignal).toBeCloseTo(0.65);
    expect(evidence.retrievalSignal).toBeCloseTo(0.45);
    expect(evidence.reliabilitySignal).toBeCloseTo(0.65);
  });

  it('drops transfer signal when transfer item is incorrect', () => {
    const evidence = scoreAttempt({
      correct: false,
      responseTimeMs: 8000,
      hintsUsed: 0,
      supportLevel: 'INDEPENDENT',
      questionType: 'TRANSFER',
      isTransferItem: true,
      isMixedItem: false,
      isReviewItem: false,
    });

    expect(evidence.transferSignal).toBeCloseTo(0.2);
    expect(evidence.masterySignal).toBeCloseTo(0.15);
  });

  it('computes forgetting signal from expected vs observed retention on review items', () => {
    const evidence = scoreAttempt({
      correct: true,
      responseTimeMs: 7000,
      hintsUsed: 0,
      supportLevel: 'INDEPENDENT',
      questionType: 'RETRIEVAL',
      isTransferItem: false,
      isMixedItem: false,
      isReviewItem: true,
      expectedRetention: 0.8,
      observedRetention: 0.4,
    });

    expect(evidence.forgettingSignal).toBeCloseTo(0.1);
  });
});
