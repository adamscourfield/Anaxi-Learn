export type KnowledgeQuestionType =
  | 'ROUTINE'
  | 'FLUENCY'
  | 'RETRIEVAL'
  | 'TRANSFER'
  | 'APPLICATION'
  | 'MIXED'
  | 'DIAGNOSTIC';

export type SupportLevel =
  | 'INDEPENDENT'
  | 'LIGHT_PROMPT'
  | 'WORKED_EXAMPLE'
  | 'SCAFFOLDED'
  | 'FULL_EXPLANATION';

export interface KnowledgeAttemptInput {
  correct: boolean;
  responseTimeMs: number;
  hintsUsed: number;
  supportLevel: SupportLevel;
  questionType: KnowledgeQuestionType;
  isTransferItem: boolean;
  isMixedItem: boolean;
  isReviewItem: boolean;
  expectedRetention?: number;
  observedRetention?: number;
}

export interface AttemptEvidenceSignals {
  masterySignal: number;
  retrievalSignal: number;
  transferSignal: number;
  forgettingSignal: number;
  reliabilitySignal: number;
  consistencyFactor: number;
}

export const KNOWLEDGE_SCORING_VERSION = 'v1';

const FAST_RESPONSE_MS = 6000;
const SLOW_RESPONSE_MS = 18000;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export function scoreAttempt(input: KnowledgeAttemptInput): AttemptEvidenceSignals {
  const independent = input.supportLevel === 'INDEPENDENT';
  const fast = input.responseTimeMs <= FAST_RESPONSE_MS;
  const slow = input.responseTimeMs >= SLOW_RESPONSE_MS;

  let masterySignal = 0.5;
  let retrievalSignal = 0.4;
  let reliabilitySignal = 0.7;

  if (input.correct && independent && input.hintsUsed === 0 && fast) {
    masterySignal = 0.95; // Case A
    retrievalSignal = 0.95;
    reliabilitySignal = 0.9;
  } else if (input.correct && independent && input.hintsUsed === 0) {
    masterySignal = 0.8; // Case B
    retrievalSignal = 0.75;
    reliabilitySignal = 0.8;
  } else if (input.correct && (slow || input.hintsUsed >= 1)) {
    masterySignal = 0.65; // Case C
    retrievalSignal = 0.45;
    reliabilitySignal = 0.65;
  } else if (!input.correct && !independent) {
    masterySignal = 0.5; // Case D approximation
    retrievalSignal = 0.3;
    reliabilitySignal = 0.55;
  } else if (!input.correct && independent) {
    masterySignal = 0.15; // Case E
    retrievalSignal = 0.1;
    reliabilitySignal = 0.85;
  }

  if (!independent) {
    retrievalSignal = Math.min(retrievalSignal, 0.6);
  }

  let transferSignal = masterySignal;
  if (input.isTransferItem || input.questionType === 'TRANSFER' || input.questionType === 'MIXED') {
    transferSignal = input.correct ? clamp01(masterySignal) : 0.2;
  }

  let forgettingSignal = 0.5;
  if (input.isReviewItem) {
    const expected = clamp01(input.expectedRetention ?? retrievalSignal);
    const observed = clamp01(input.observedRetention ?? (input.correct ? 1 : 0));
    forgettingSignal = clamp01(0.5 + (observed - expected));
  }

  return {
    masterySignal: clamp01(masterySignal),
    retrievalSignal: clamp01(retrievalSignal),
    transferSignal: clamp01(transferSignal),
    forgettingSignal: clamp01(forgettingSignal),
    reliabilitySignal: clamp01(reliabilitySignal),
    consistencyFactor: clamp01(input.correct ? 0.8 : 0.6),
  };
}
