import { parseAnswerType } from '@/features/items/itemMeta';

function stripDiacritics(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeAnswer(input: string): string {
  const normalized = stripDiacritics(input)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/,/g, ' ')
    .replace(/\band\b/g, ' ')
    .replace(/[’']/g, '')
    .replace(/[-_]/g, ' ')
    .replace(/[^a-z0-9./\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized === 'true' || normalized === 'correct' || normalized === 'yes') return 'true';
  if (normalized === 'false' || normalized === 'incorrect' || normalized === 'no') return 'false';

  return normalized;
}

function acceptedAnswers(correctAnswer: string): string[] {
  const split = correctAnswer
    .split(/\n|\||;/)
    .map((s) => s.trim())
    .filter(Boolean);
  return split.length > 0 ? split : [correctAnswer.trim()];
}

export function gradeAttempt(correctAnswer: string, submittedAnswer: string): boolean {
  const submitted = normalizeAnswer(submittedAnswer);
  return acceptedAnswers(correctAnswer).some((candidate) => normalizeAnswer(candidate) === submitted);
}

export function getAnswerFormatHint(
  itemType: string | null | undefined,
  question?: string | null,
  options?: unknown
): string | null {
  const answerType = parseAnswerType(itemType, question, options, null);
  if (answerType === 'TRUE_FALSE') return 'Answer tip: choose True or False.';
  if (answerType === 'SHORT_TEXT') return 'Formatting tip: capitals, commas, and “and” are all accepted.';
  if (answerType === 'SHORT_NUMERIC') return 'Formatting tip: enter digits only (no words).';
  return null;
}
