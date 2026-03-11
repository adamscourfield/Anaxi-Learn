import {
  parseAnswerType,
  parseItemOptions,
  stripStudentQuestionLabel,
  type AnswerType,
  type QuestionRole,
} from './itemMeta';

export type ItemPurpose = 'ONBOARDING' | 'LEARN' | 'RETEACH_SHADOW';

export interface ItemPurposeInput {
  question: string;
  type?: string | null;
  options: unknown;
  answer: string;
}

export interface InferredItemPurpose {
  purpose: ItemPurpose;
  answerType: AnswerType;
  questionRole: QuestionRole;
  route: 'A' | 'B' | 'C' | null;
  choices: string[];
}

const ORDER_PROMPT_RE =
  /\b(order|put in order|ascending order|descending order|ascending|descending|coldest to warmest|warmest to coldest|smallest to largest|largest to smallest)\b/i;
const SIGN_PROMPT_RE = /\b(fill (?:in )?(?:the )?(?:sign|symbol)|complete)\b/i;
const NUMERIC_RESPONSE_PROMPT_RE =
  /\b(in figures|what is the value|which is greater|which is less|which is closer to zero|what place|value of digit|digit \d in|correct this|expanded form)\b/i;
const WRITTEN_RESPONSE_PROMPT_RE = /\b(write|state|give|enter|in words)\b/i;
const CHOICE_PROMPT_RE = /\b(which|choose|select|does\b|true or false)\b/i;
const DIAGNOSTIC_LABEL_RE = /\bDQ(\d*)\s*[:\-]/i;
const SHADOW_LABEL_RE = /\bSC[-:]?([ABC])(\d*)\s*[:\-]/i;
const PLACEHOLDER_RE = /placeholder question\s*(\d+)/i;

function questionText(question: string) {
  return stripStudentQuestionLabel(question).toLowerCase();
}

function dedupeChoices(choices: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const choice of choices) {
    const key = choice.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(choice);
  }

  return out;
}

function answerLooksNumeric(answer: string): boolean {
  return /^-?[\d,\s.]+$/.test(answer.trim());
}

function inferPurpose(question: string, explicitRole: QuestionRole, explicitRoute: 'A' | 'B' | 'C' | null): ItemPurpose {
  if (explicitRole === 'shadow' || explicitRoute) return 'RETEACH_SHADOW';
  if (explicitRole === 'anchor' || explicitRole === 'misconception' || explicitRole === 'prerequisite_probe') {
    return 'ONBOARDING';
  }
  if (SHADOW_LABEL_RE.test(question)) return 'RETEACH_SHADOW';
  if (DIAGNOSTIC_LABEL_RE.test(question) || PLACEHOLDER_RE.test(question)) return 'ONBOARDING';
  return 'LEARN';
}

function inferQuestionRole(question: string, purpose: ItemPurpose, explicitRole: QuestionRole): QuestionRole {
  if (explicitRole !== 'practice') return explicitRole;

  if (purpose === 'RETEACH_SHADOW') return 'shadow';
  if (purpose === 'LEARN') return 'practice';

  const diagnosticMatch = question.match(DIAGNOSTIC_LABEL_RE);
  const placeholderMatch = question.match(PLACEHOLDER_RE);
  const diagnosticOrdinal = Number(diagnosticMatch?.[1] ?? placeholderMatch?.[1] ?? 0);

  if (diagnosticOrdinal === 1) return 'anchor';
  if (diagnosticOrdinal === 2) return 'misconception';
  if (diagnosticOrdinal === 3) return 'prerequisite_probe';
  if (diagnosticOrdinal >= 4) return 'transfer';

  return 'anchor';
}

function inferRoute(question: string, explicitRoute: 'A' | 'B' | 'C' | null): 'A' | 'B' | 'C' | null {
  if (explicitRoute) return explicitRoute;
  const match = question.match(SHADOW_LABEL_RE);
  const route = match?.[1]?.toUpperCase();
  return route === 'A' || route === 'B' || route === 'C' ? route : null;
}

function inferAnswerType(input: ItemPurposeInput, purpose: ItemPurpose): AnswerType {
  const existing = parseAnswerType(input.type, input.question, input.options, input.answer);
  if (existing === 'TRUE_FALSE') return 'TRUE_FALSE';

  const text = questionText(input.question);

  if (ORDER_PROMPT_RE.test(text)) return 'SHORT_TEXT';
  if (SIGN_PROMPT_RE.test(text) || text.includes('__')) return 'SHORT_TEXT';
  if (NUMERIC_RESPONSE_PROMPT_RE.test(text)) return answerLooksNumeric(input.answer) ? 'SHORT_NUMERIC' : 'SHORT_TEXT';
  if (WRITTEN_RESPONSE_PROMPT_RE.test(text)) return answerLooksNumeric(input.answer) ? 'SHORT_NUMERIC' : 'SHORT_TEXT';

  if (purpose === 'RETEACH_SHADOW' && !CHOICE_PROMPT_RE.test(text)) {
    return answerLooksNumeric(input.answer) ? 'SHORT_NUMERIC' : 'SHORT_TEXT';
  }

  return existing;
}

export function inferItemPurpose(input: ItemPurposeInput): InferredItemPurpose {
  const parsed = parseItemOptions(input.options);
  const route = inferRoute(input.question, parsed.meta.route);
  const purpose = inferPurpose(input.question, parsed.meta.questionRole, route);
  const questionRole = inferQuestionRole(input.question, purpose, parsed.meta.questionRole);
  const answerType = inferAnswerType(input, purpose);
  const choices = answerType === 'MCQ' || answerType === 'TRUE_FALSE' ? dedupeChoices(parsed.choices) : [];

  return {
    purpose,
    answerType,
    questionRole,
    route,
    choices,
  };
}

export function isOnboardingCandidate(input: ItemPurposeInput): boolean {
  return inferItemPurpose(input).purpose === 'ONBOARDING';
}

export function isLearnCandidate(input: ItemPurposeInput): boolean {
  return inferItemPurpose(input).purpose === 'LEARN';
}

export function isShadowCandidate(input: ItemPurposeInput, routeType?: 'A' | 'B' | 'C'): boolean {
  const inferred = inferItemPurpose(input);
  if (inferred.purpose !== 'RETEACH_SHADOW') return false;
  if (!routeType) return true;
  return inferred.route === routeType;
}
