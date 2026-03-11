import { ImportedQuestion, ReviewIssue } from '../types';

export function getReviewIssues(question: ImportedQuestion): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  if (!question.curriculum.objectiveId) {
    issues.push({ code: 'missing_objective_id', message: 'Objective mapping is missing.', severity: 'error' });
  }

  if (question.quality.mappingConfidence < 0.75) {
    issues.push({ code: 'low_mapping_confidence', message: 'Mapping confidence is below the review threshold.', severity: 'error' });
  }

  if (question.marking.markingMethod === 'MANUAL_RUBRIC' && !question.marking.rubric) {
    issues.push({ code: 'open_response_marking_unclear', message: 'Open-response item needs a clearer rubric or a machine-markable answer.', severity: 'error' });
  }

  if (question.adaptive.answerModeAllowed.length === 0) {
    issues.push({ code: 'no_valid_answer_modes', message: 'No valid answer mode could be assigned.', severity: 'error' });
  }

  if (question.pedagogical.learningPhase === 'RETAIN' && !question.adaptive.isSpacedRetrievalEligible) {
    issues.push({
      code: 'conflicting_retrieval_metadata',
      message: 'Retain-phase item is marked as not suitable for spaced retrieval.',
      severity: 'error',
    });
  }

  return issues;
}
