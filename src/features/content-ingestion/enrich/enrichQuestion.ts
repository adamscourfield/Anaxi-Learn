import { EnrichmentContext, ImportedQuestion, RawExtractedQuestion, LearningPhase, DifficultyLevel, QuestionPurpose, MarkingMethod, ObjectiveMapRow } from '../types';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function inferLearningPhase(question: RawExtractedQuestion): LearningPhase {
  const stem = question.stem.toLowerCase();
  if (stem.includes('what is the correct answer') || stem.includes('rewrite this false statement') || stem.includes('what have they forgotten')) {
    return 'RETEACH';
  }
  if (stem.includes('true or false') || stem.startsWith('which word') || stem.startsWith('what does')) {
    return 'ONBOARDING';
  }
  return 'LEARN';
}

function inferDifficulty(question: RawExtractedQuestion): DifficultyLevel {
  const wordCount = question.stem.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 18 || /how much.*left|median age|using the digits/i.test(question.stem)) return 'HIGH';
  if (wordCount >= 10 || (question.options?.length ?? 0) > 0) return 'MEDIUM';
  return 'LOW';
}

function inferQuestionPurpose(phase: LearningPhase): QuestionPurpose {
  if (phase === 'ONBOARDING') return 'BASELINE_CHECK';
  if (phase === 'RETEACH') return 'MISCONCEPTION_RETEACH';
  if (phase === 'RETAIN') return 'SPACED_RETRIEVAL';
  return 'CORE_PRACTICE';
}

function chooseObjective(question: RawExtractedQuestion, context: EnrichmentContext): { row: ObjectiveMapRow | null; confidence: number } {
  const hint = question.detectedObjectiveHint;
  if (hint) {
    const exact = context.objectiveMap.find((row) => normalize(row.objectiveId) === normalize(hint));
    if (exact) return { row: exact, confidence: 0.95 };
  }

  const subtopic = question.extractedSubtopic;
  if (subtopic) {
    const exactSubtopic = context.objectiveMap.find((row) => normalize(row.subtopic) === normalize(subtopic));
    if (exactSubtopic) return { row: exactSubtopic, confidence: 0.82 };
    const fuzzy = context.objectiveMap.find((row) => normalize(row.subtopic).includes(normalize(subtopic)) || normalize(subtopic).includes(normalize(row.subtopic)));
    if (fuzzy) return { row: fuzzy, confidence: 0.76 };
  }

  return { row: null, confidence: context.objectiveMap.length > 0 ? 0.2 : 0.05 };
}

function inferAllowedModes(question: RawExtractedQuestion, objective: ObjectiveMapRow | null, context: EnrichmentContext): string[] {
  const configured = objective?.allowedModes.filter(Boolean) ?? [];
  if (configured.length > 0) return configured;

  if (question.options && question.options.length === 2 && question.options.every((option) => ['true', 'false', 'yes', 'no'].includes(normalize(option)))) {
    return ['TRUE_FALSE'];
  }
  if (question.options && question.options.length > 1) return ['SINGLE_CHOICE'];
  if (/order .*:|coldest to warmest|largest to smallest|smallest to largest/i.test(question.stem)) return ['ORDER_SEQUENCE'];
  if (/calculate|find the perimeter|find the median|what is the value|how much|write .* in figures/i.test(question.stem)) return ['NUMERIC'];
  if (/place the correct symbol|write .* in words|rewrite/i.test(question.stem)) return ['SHORT_TEXT'];

  return context.answerModeBank.length > 0 ? [context.answerModeBank[0].id] : [];
}

function inferBlockedModes(allowedModes: string[]): string[] | undefined {
  if (allowedModes.includes('ORDER_SEQUENCE')) return ['SINGLE_CHOICE', 'TRUE_FALSE'];
  if (allowedModes.includes('NUMERIC')) return ['SINGLE_CHOICE'];
  return undefined;
}

function inferMisconceptions(question: RawExtractedQuestion): string[] {
  const stem = question.stem.toLowerCase();
  const tags = new Set<string>();
  if (stem.includes('correct symbol') || stem.includes('false statement')) tags.add('SYMBOL_DIRECTION_CONFUSION');
  if (stem.includes('underlined digit') || stem.includes('value of the digit')) tags.add('PLACE_VALUE_CONFUSION');
  if (stem.includes('median')) tags.add('UNORDERED_MEDIAN_ERROR');
  if (stem.includes('perimeter')) tags.add('SIDE_OMISSION');
  if (stem.includes('money') || stem.includes('£')) tags.add('OPERATION_CONFUSION');
  return [...tags];
}

function inferReteachCandidates(objectiveId: string | null, misconceptions: string[]): string[] {
  const candidates = new Set<string>();
  if (objectiveId) candidates.add(`${objectiveId}:default-reteach`);
  for (const misconception of misconceptions) candidates.add(`misconception:${misconception.toLowerCase()}`);
  return [...candidates];
}

function inferMarking(question: RawExtractedQuestion, allowedModes: string[]): { method: MarkingMethod; correctAnswer: string; distractors?: string[]; tolerance?: number } {
  const correctAnswer =
    question.detectedAnswer ??
    '';
  const inferredAnswer =
    correctAnswer || (allowedModes.includes('TRUE_FALSE') && /true or false/i.test(question.stem) ? 'True' : '');
  if (allowedModes.includes('NUMERIC')) {
    return {
      method: 'AUTO_NUMERIC_TOLERANCE',
      correctAnswer: inferredAnswer,
      tolerance: 0,
    };
  }
  if (allowedModes.includes('ORDER_SEQUENCE')) {
    return {
      method: 'AUTO_SET_MATCH',
      correctAnswer: inferredAnswer,
    };
  }
  if (allowedModes.includes('SHORT_TEXT') && !inferredAnswer) {
    return {
      method: 'MANUAL_RUBRIC',
      correctAnswer: '',
      distractors: question.detectedDistractors,
    };
  }
  return {
    method: 'AUTO_EXACT',
    correctAnswer: inferredAnswer,
    distractors: question.detectedDistractors,
  };
}

export function enrichQuestion(question: RawExtractedQuestion, context: EnrichmentContext): ImportedQuestion {
  const learningPhase = inferLearningPhase(question);
  const difficulty = inferDifficulty(question);
  const { row: objectiveRow, confidence: objectiveConfidence } = chooseObjective(question, context);
  const allowedModes = inferAllowedModes(question, objectiveRow, context);
  const misconceptions = inferMisconceptions(question);
  const mapping = inferMarking(question, allowedModes);
  const mappingConfidence = Math.min(
    1,
    objectiveConfidence
      + (allowedModes.length > 0 ? 0.12 : 0)
      + (mapping.correctAnswer ? 0.08 : 0)
      + (question.extractedSubtopic ? 0.04 : 0)
  );
  const needsHumanReview =
    mappingConfidence < context.confidenceThreshold ||
    !objectiveRow ||
    allowedModes.length === 0 ||
    (mapping.method === 'MANUAL_RUBRIC' && !mapping.correctAnswer);

  return {
    provenance: question.provenance,
    curriculum: {
      subject: objectiveRow?.subject || 'ks3-maths',
      yearBand: objectiveRow?.yearBand || 'Y7',
      strand: objectiveRow?.strand || question.extractedStrand || 'Number',
      subtopic: objectiveRow?.subtopic || question.extractedSubtopic || 'Unmapped subtopic',
      objectiveId: objectiveRow?.objectiveId ?? question.detectedObjectiveHint ?? null,
    },
    pedagogical: {
      learningPhase,
      difficulty,
      questionPurpose: inferQuestionPurpose(learningPhase),
    },
    adaptive: {
      answerModeAllowed: allowedModes,
      answerModeBlocked: inferBlockedModes(allowedModes),
      misconceptionTagsTarget: misconceptions,
      reteachRouteCandidates: inferReteachCandidates(objectiveRow?.objectiveId ?? question.detectedObjectiveHint ?? null, misconceptions),
      isSpacedRetrievalEligible: learningPhase !== 'RETEACH' && difficulty !== 'HIGH',
    },
    marking: {
      markingMethod: mapping.method,
      correctAnswer: mapping.correctAnswer,
      distractors: mapping.distractors,
      tolerance: mapping.tolerance,
    },
    quality: {
      extractionConfidence: question.extractionConfidence,
      mappingConfidence,
      needsHumanReview,
      status: needsHumanReview ? 'REVIEW' : 'VALIDATED',
      version: 1,
    },
    stem: question.stem,
    options: question.options,
    notes: question.rawText === question.stem ? undefined : [`raw:${question.rawText}`],
  };
}
