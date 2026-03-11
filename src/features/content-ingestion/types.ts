export type SourceType = 'PPTX' | 'DOCX';

export type LearningPhase = 'ONBOARDING' | 'LEARN' | 'RETEACH' | 'RETAIN';
export type DifficultyLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type QuestionPurpose =
  | 'BASELINE_CHECK'
  | 'CORE_PRACTICE'
  | 'MISCONCEPTION_RETEACH'
  | 'SPACED_RETRIEVAL'
  | 'EXIT_CHECK';

export type MarkingMethod =
  | 'AUTO_EXACT'
  | 'AUTO_SET_MATCH'
  | 'AUTO_NUMERIC_TOLERANCE'
  | 'MANUAL_RUBRIC';

export type ImportedQuestionStatus = 'DRAFT' | 'REVIEW' | 'VALIDATED' | 'PUBLISHED' | 'REJECTED';

export interface ExtractionProvenance {
  sourceType: SourceType;
  sourceFile: string;
  slideOrPageRef: string;
}

export interface CurriculumMetadata {
  subject: string;
  yearBand: string;
  strand: string;
  subtopic: string;
  objectiveId: string | null;
}

export interface PedagogicalMetadata {
  learningPhase: LearningPhase;
  difficulty: DifficultyLevel;
  questionPurpose: QuestionPurpose;
}

export interface AdaptiveMetadata {
  answerModeAllowed: string[];
  answerModeBlocked?: string[];
  misconceptionTagsTarget: string[];
  reteachRouteCandidates: string[];
  isSpacedRetrievalEligible: boolean;
}

export interface MarkingMetadata {
  markingMethod: MarkingMethod;
  correctAnswer: string;
  distractors?: string[];
  tolerance?: number;
  rubric?: string;
}

export interface QualityMetadata {
  extractionConfidence: number;
  mappingConfidence: number;
  needsHumanReview: boolean;
  status: ImportedQuestionStatus;
  version: number;
}

export interface ImportedQuestion {
  provenance: ExtractionProvenance;
  curriculum: CurriculumMetadata;
  pedagogical: PedagogicalMetadata;
  adaptive: AdaptiveMetadata;
  marking: MarkingMetadata;
  quality: QualityMetadata;
  stem: string;
  options?: string[];
  notes?: string[];
}

export interface UnresolvedSegment {
  sourceType: SourceType;
  sourceFile: string;
  slideOrPageRef: string;
  rawText: string;
  reason: string;
}

export interface RawExtractedQuestion {
  provenance: ExtractionProvenance;
  rawText: string;
  stem: string;
  options?: string[];
  detectedAnswer?: string;
  detectedDistractors?: string[];
  detectedObjectiveHint?: string | null;
  extractedSubtopic?: string | null;
  extractedStrand?: string | null;
  extractionConfidence: number;
}

export interface ExtractionResult {
  questions: RawExtractedQuestion[];
  unresolvedSegments: UnresolvedSegment[];
}

export interface ReviewIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface EnrichmentContext {
  objectiveMap: ObjectiveMapRow[];
  answerModeBank: AnswerModeBankEntry[];
  selectionRulesText: string;
  confidenceThreshold: number;
}

export interface ObjectiveMapRow {
  objectiveId: string;
  subject: string;
  yearBand: string;
  strand: string;
  subtopic: string;
  allowedModes: string[];
  learningPhases: string[];
  raw: Record<string, string>;
}

export interface AnswerModeBankEntry {
  id: string;
  label: string;
  aliases: string[];
  raw: Record<string, unknown>;
}

export interface PublishResult {
  publishedCount: number;
  stagedCount: number;
  rejectedCount: number;
  auditLogPath: string;
  stagingPath: string;
}
