import { z } from 'zod';
import { ItemInteractionType, getItemContent, normalizeAnswer } from '../learn/itemContent';

export const CanonicalQuestionFormatSchema = z.enum([
  'TRUE_FALSE',
  'SINGLE_CHOICE',
  'SHORT_TEXT',
  'NUMERIC',
  'ORDER_SEQUENCE',
]);

export type CanonicalQuestionFormat = z.infer<typeof CanonicalQuestionFormatSchema>;

const LegacyQuestionFormatSchema = z.enum([
  'MCQ',
  'SHORT',
  'NUMERIC',
  'MULTI_STEP',
  'MATCH',
  'OTHER',
]);

const QuestionFormatSchema = z.union([CanonicalQuestionFormatSchema, LegacyQuestionFormatSchema]).optional();

export const MappingRowSchema = z.object({
  source: z.object({
    question_ref: z.string(),
    source_file: z.string().optional(),
  }),
  question: z.object({
    stem: z.string().min(1),
    format: QuestionFormatSchema,
    options: z.array(z.string()).optional(),
    answer: z.string().min(1),
  }),
  skills: z.object({
    primary_skill_code: z.string().min(1),
    secondary_skill_codes: z.array(z.string()).optional(),
  }),
  marking: z.object({
    accepted_answers: z.array(z.string()).optional(),
    tolerance: z.number().optional(),
  }).optional(),
});

export type MappingRow = z.infer<typeof MappingRowSchema>;

export interface StoredItemContract {
  question: string;
  type: string;
  answer: string;
  options?: unknown;
}

export interface ContractIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

function rawChoiceList(options: unknown): string[] {
  if (Array.isArray(options)) {
    return options.filter((value): value is string => typeof value === 'string');
  }

  if (options && typeof options === 'object' && Array.isArray((options as { choices?: unknown }).choices)) {
    return (options as { choices: unknown[] }).choices.filter((value): value is string => typeof value === 'string');
  }

  return [];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeNumber(value: string): number | null {
  const cleaned = value.replace(/,/g, '').trim();
  if (!/^[-+]?\d*\.?\d+$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function numericDistractors(answer: string): string[] {
  const n = normalizeNumber(answer);
  if (n == null) return [];

  const candidates = new Set<string>();
  const abs = Math.abs(n);
  const delta = abs >= 1000 ? 100 : abs >= 100 ? 10 : abs >= 10 ? 1 : 0.1;

  candidates.add(String(n + delta));
  candidates.add(String(n - delta));
  candidates.add(String(n + delta * 2));

  return Array.from(candidates)
    .map((v) => (v.includes('.') ? String(Number(v)) : v))
    .filter((v) => v !== answer)
    .slice(0, 3);
}

export function parseOrderedValues(stem: string): string[] {
  const match = stem.match(/:\s*(.+?)\.?$/);
  if (!match) return [];

  return match[1]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function inferCanonicalQuestionFormat(
  format: string | undefined,
  stem: string,
  answer: string
): CanonicalQuestionFormat {
  const lcStem = stem.toLowerCase();
  const lcAnswer = answer.toLowerCase();

  if (format && CanonicalQuestionFormatSchema.safeParse(format).success) {
    return format as CanonicalQuestionFormat;
  }

  if (format === 'NUMERIC') return 'NUMERIC';
  if (format === 'MCQ') return 'SINGLE_CHOICE';
  if (format === 'SHORT') return lcAnswer === 'true' || lcAnswer === 'false' ? 'TRUE_FALSE' : 'SHORT_TEXT';
  if (format === 'MATCH') return 'ORDER_SEQUENCE';

  if (lcAnswer === 'true' || lcAnswer === 'false') {
    return 'TRUE_FALSE';
  }

  if (lcStem.startsWith('order ') || lcStem.includes('coldest to warmest') || lcStem.includes('smallest to largest')) {
    return 'ORDER_SEQUENCE';
  }

  if (/which is greater:\s*([^?]+?)\s+or\s+([^?]+)\??/i.test(stem)) {
    return 'SINGLE_CHOICE';
  }

  if (normalizeNumber(answer) != null) {
    return 'NUMERIC';
  }

  if (lcStem.includes('equivalent to') || lcStem.includes('at least')) {
    return 'SINGLE_CHOICE';
  }

  return 'SHORT_TEXT';
}

export function deriveChoicesForMapping(
  stem: string,
  answer: string,
  canonicalFormat: CanonicalQuestionFormat,
  explicitOptions: string[] = []
): string[] {
  if (explicitOptions.length > 0) {
    return unique(explicitOptions.map((option) => option.trim()).filter(Boolean));
  }

  if (canonicalFormat === 'TRUE_FALSE') {
    return ['True', 'False'];
  }

  if (canonicalFormat === 'ORDER_SEQUENCE') {
    return parseOrderedValues(stem);
  }

  const greaterMatch = stem.match(/which is greater:\s*([^?]+?)\s+or\s+([^?]+)\??/i);
  if (greaterMatch) {
    return [greaterMatch[1].trim(), greaterMatch[2].trim()];
  }

  const lcStem = stem.toLowerCase();

  if (lcStem.includes('equivalent to')) {
    return unique([answer, '1 > 2', '2 < 1', '1 = 2']);
  }

  if (lcStem.includes('at least')) {
    return unique([answer, '? > 7', '? ≤ 7', '? < 7']);
  }

  if (canonicalFormat === 'SINGLE_CHOICE' || canonicalFormat === 'NUMERIC') {
    const numeric = numericDistractors(answer);
    if (numeric.length >= 3) {
      return unique([answer, ...numeric]);
    }
  }

  return [answer];
}

export function deriveStoredItemFromMapping(row: MappingRow): {
  type: ItemInteractionType;
  answer: string;
  options: { choices: string[]; acceptedAnswers: string[] };
  canonicalFormat: CanonicalQuestionFormat;
} {
  const parsed = MappingRowSchema.parse(row);
  const answer = parsed.marking?.accepted_answers?.[0] ?? parsed.question.answer;
  const canonicalFormat = inferCanonicalQuestionFormat(parsed.question.format, parsed.question.stem, answer);
  const acceptedAnswers = unique(parsed.marking?.accepted_answers ?? [answer]);
  const choices = deriveChoicesForMapping(parsed.question.stem, answer, canonicalFormat, parsed.question.options);

  const typeByFormat: Record<CanonicalQuestionFormat, ItemInteractionType> = {
    TRUE_FALSE: 'TRUE_FALSE',
    SINGLE_CHOICE: 'MCQ',
    SHORT_TEXT: 'SHORT_TEXT',
    NUMERIC: 'SHORT_TEXT',
    ORDER_SEQUENCE: 'ORDER',
  };

  return {
    type: typeByFormat[canonicalFormat],
    answer,
    options: {
      choices,
      acceptedAnswers,
    },
    canonicalFormat,
  };
}

export function getItemContractIssues(item: StoredItemContract): ContractIssue[] {
  const content = getItemContent(item);
  const issues: ContractIssue[] = [];
  const rawChoices = rawChoiceList(item.options);
  const normalizedChoiceSet = new Set(content.choices.map((choice) => normalizeAnswer(choice)));
  const normalizedAcceptedAnswers = content.acceptedAnswers.map((answer) => normalizeAnswer(answer));

  if (rawChoices.length !== content.choices.length) {
    issues.push({ code: 'duplicate_choices', message: 'Choices contain duplicates before normalization.', severity: 'error' });
  }

  if (content.type === 'MCQ') {
    if (content.choices.length < 2) {
      issues.push({ code: 'mcq_min_choices', message: 'Single-choice items need at least two unique choices.', severity: 'error' });
    }
    if (!normalizedChoiceSet.has(normalizeAnswer(content.canonicalAnswer))) {
      issues.push({ code: 'mcq_missing_answer', message: 'The canonical answer is not present in the choice list.', severity: 'error' });
    }
  }

  if (content.type === 'TRUE_FALSE') {
    const truthChoices = new Set(content.choices.map((choice) => choice.toLowerCase()));
    if (content.choices.length !== 2 || !truthChoices.has('true') || !truthChoices.has('false')) {
      issues.push({ code: 'tf_invalid_choices', message: 'True/false items must contain exactly True and False.', severity: 'error' });
    }
  }

  if (content.type === 'SHORT_TEXT' && content.acceptedAnswers.length === 0) {
    issues.push({ code: 'short_missing_answers', message: 'Short-answer items need at least one accepted answer.', severity: 'error' });
  }

  if (content.type === 'ORDER') {
    if (content.choices.length < 2) {
      issues.push({ code: 'order_min_choices', message: 'Ordered items need at least two values to arrange.', severity: 'error' });
    }

    const orderedAnswers = normalizeAnswer(content.canonicalAnswer).split('|');
    const missing = orderedAnswers.filter((answer) => !normalizedChoiceSet.has(answer));
    if (missing.length > 0) {
      issues.push({ code: 'order_missing_answer_values', message: 'The stored ordered answer includes values not present in the choice list.', severity: 'error' });
    }
  }

  const duplicateAcceptedAnswers = normalizedAcceptedAnswers.length !== new Set(normalizedAcceptedAnswers).size;
  if (duplicateAcceptedAnswers) {
    issues.push({ code: 'duplicate_accepted_answers', message: 'Accepted answers contain duplicates after normalization.', severity: 'warning' });
  }

  return issues;
}
