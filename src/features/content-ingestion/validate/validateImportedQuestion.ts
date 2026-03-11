import { ImportedQuestion, ReviewIssue } from '../types';
import { getReviewIssues } from '../review/reviewRules';
import { EnrichmentContext } from '../types';
import { objectiveExists, resolveKnownAnswerModeIds } from '../modeBank';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function validateImportedQuestion(question: ImportedQuestion, context: EnrichmentContext): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  if (!question.stem.trim()) issues.push({ code: 'missing_stem', message: 'Question stem is required.', severity: 'error' });
  if (!question.provenance.sourceFile) issues.push({ code: 'missing_source_file', message: 'Source file is required.', severity: 'error' });
  if (!question.provenance.slideOrPageRef) issues.push({ code: 'missing_slide_ref', message: 'Slide or page reference is required.', severity: 'error' });
  if (!question.curriculum.subject) issues.push({ code: 'missing_subject', message: 'Subject is required.', severity: 'error' });
  if (!question.curriculum.yearBand) issues.push({ code: 'missing_year_band', message: 'Year band is required.', severity: 'error' });
  if (!question.curriculum.subtopic) issues.push({ code: 'missing_subtopic', message: 'Subtopic is required.', severity: 'error' });
  if (!question.marking.markingMethod) issues.push({ code: 'missing_marking_method', message: 'Marking method is required.', severity: 'error' });

  const knownModes = resolveKnownAnswerModeIds(context);
  if (knownModes.size === 0) {
    issues.push({
      code: 'missing_answer_mode_bank',
      message: 'Answer mode bank files are missing from docs/learning-design/answer-mode-bank.',
      severity: 'error',
    });
  }

  const invalidModes = question.adaptive.answerModeAllowed.filter((mode) => !knownModes.has(normalize(mode)));
  if (invalidModes.length > 0) {
    issues.push({
      code: 'unknown_answer_modes',
      message: `Unknown answer modes: ${invalidModes.join(', ')}`,
      severity: 'error',
    });
  }

  if (!objectiveExists(context, question.curriculum.objectiveId)) {
    issues.push({
      code: 'unknown_objective',
      message: `Objective ${question.curriculum.objectiveId ?? '(missing)'} does not exist in the objective map.`,
      severity: 'error',
    });
  }

  const blocked = new Set(question.adaptive.answerModeBlocked ?? []);
  const effectiveAllowed = question.adaptive.answerModeAllowed.filter((mode) => !blocked.has(mode));
  if (effectiveAllowed.length === 0) {
    issues.push({
      code: 'no_effective_allowed_modes',
      message: 'At least one allowed answer mode must remain after applying blocks.',
      severity: 'error',
    });
  }

  return [...issues, ...getReviewIssues(question)];
}
