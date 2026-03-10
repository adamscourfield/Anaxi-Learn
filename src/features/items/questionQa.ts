import { gradeAttempt } from '@/features/learn/gradeAttempt';
import {
  parseAnswerType,
  parseItemOptions,
  stripStudentQuestionLabel,
  type AnswerType,
} from './itemMeta';

export interface QaIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface QaItemShape {
  question: string;
  type: string | null | undefined;
  options: unknown;
  answer: string;
}

export interface QaSummary {
  answerType: AnswerType;
  answerModeLabel: string;
  displayQuestion: string;
  choices: string[];
  issues: QaIssue[];
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

function hasOptionMatch(answer: string, choices: string[]): boolean {
  return choices.some((choice) => gradeAttempt(choice, answer));
}

function hasDuplicateChoices(choices: string[]): boolean {
  const seen = new Set<string>();
  for (const choice of choices) {
    const key = normalized(choice);
    if (!key) continue;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function labelForAnswerType(answerType: AnswerType): string {
  switch (answerType) {
    case 'TRUE_FALSE':
      return 'True / False buttons';
    case 'SHORT_TEXT':
      return 'Typed short answer';
    case 'SHORT_NUMERIC':
      return 'Typed numeric answer';
    default:
      return 'Single-choice buttons';
  }
}

export function summarizeQuestionQa(item: QaItemShape): QaSummary {
  const parsed = parseItemOptions(item.options);
  const answerType = parseAnswerType(item.type, item.question, item.options, item.answer);
  const displayQuestion = stripStudentQuestionLabel(item.question);
  const issues: QaIssue[] = [];

  if (!displayQuestion) {
    issues.push({ code: 'empty_display_stem', message: 'Rendered student question would be empty after label cleaning.', severity: 'error' });
  }

  if (displayQuestion !== item.question.trim()) {
    issues.push({ code: 'label_leak', message: 'Question text contains internal labels/prefixes that should not be shown to students.', severity: 'warning' });
  }

  if (hasDuplicateChoices(parsed.choices)) {
    issues.push({ code: 'duplicate_choices', message: 'Answer choices contain duplicates after normalization.', severity: 'error' });
  }

  if ((answerType === 'MCQ' || answerType === 'TRUE_FALSE') && parsed.choices.length < 2) {
    issues.push({ code: 'too_few_choices', message: 'Choice-based question has fewer than two valid options.', severity: 'error' });
  }

  if ((answerType === 'MCQ' || answerType === 'TRUE_FALSE') && !hasOptionMatch(item.answer, parsed.choices)) {
    issues.push({ code: 'answer_missing_from_choices', message: 'Stored correct answer is not available among the student choices.', severity: 'error' });
  }

  if (answerType === 'TRUE_FALSE') {
    const booleanChoices = new Set(parsed.choices.map((choice) => normalized(choice)));
    const validSets =
      (booleanChoices.has('true') && booleanChoices.has('false')) ||
      (booleanChoices.has('correct') && booleanChoices.has('incorrect')) ||
      (booleanChoices.has('yes') && booleanChoices.has('no'));
    if (!validSets) {
      issues.push({ code: 'invalid_true_false_choices', message: 'True/False question does not expose a clean boolean choice pair.', severity: 'error' });
    }
  }

  if ((answerType === 'SHORT_TEXT' || answerType === 'SHORT_NUMERIC') && parsed.choices.length > 0) {
    issues.push({ code: 'typed_question_has_choices', message: 'Typed-answer question still has stored choices. Check whether the mode is correct.', severity: 'warning' });
  }

  return {
    answerType,
    answerModeLabel: labelForAnswerType(answerType),
    displayQuestion,
    choices: parsed.choices,
    issues,
  };
}
