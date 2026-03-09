export type QuestionRole = 'anchor' | 'misconception' | 'prerequisite_probe' | 'transfer' | 'shadow' | 'practice';
export type MisconceptionTag = string;
export type TransferLevel = 'none' | 'low' | 'medium' | 'high';
export type StrictnessLevel = 'exact' | 'normalized';
export type AnswerType = 'MCQ' | 'SHORT_TEXT' | 'SHORT_NUMERIC' | 'TRUE_FALSE';

export interface ItemMeta {
  questionRole: QuestionRole;
  misconceptionTag: MisconceptionTag | null;
  route: 'A' | 'B' | 'C' | null;
  transferLevel: TransferLevel;
  strictnessLevel: StrictnessLevel;
}

export interface ParsedItemOptions {
  choices: string[];
  meta: ItemMeta;
}

const DEFAULT_META: ItemMeta = {
  questionRole: 'practice',
  misconceptionTag: null,
  route: null,
  transferLevel: 'none',
  strictnessLevel: 'normalized',
};

function parseRoute(input: unknown): ItemMeta['route'] {
  if (input === 'A' || input === 'B' || input === 'C') return input;
  return null;
}

export function stripStudentQuestionLabel(question: unknown): string {
  if (typeof question !== 'string') return '';

  const patterns = [
    /^\s*\[[A-Za-z]{1,5}\d*(?:\.\d+){1,4}\]\s*/,
    /^\s*[A-Za-z]{1,5}\d*(?:\.\d+){1,4}\s*[:\-–]\s*/,
    /^\s*subtopic\s+[A-Za-z0-9.\-_/]+\s*[:\-–]\s*/i,
  ];

  let cleaned = question;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim();
}

export function parseItemOptions(options: unknown): ParsedItemOptions {
  // Legacy shape: options is just string[]
  if (Array.isArray(options)) {
    const choices = options.filter((o): o is string => typeof o === 'string' && o.trim().length > 0);
    return { choices, meta: DEFAULT_META };
  }

  // Current shape for richer metadata: { choices: string[], meta: {...} }
  if (options && typeof options === 'object') {
    const raw = options as {
      choices?: unknown;
      meta?: {
        role?: unknown;
        question_role?: unknown;
        misconception_tag?: unknown;
        route?: unknown;
        transfer_level?: unknown;
        strictness_level?: unknown;
      };
    };

    const choices = Array.isArray(raw.choices)
      ? raw.choices.filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
      : [];

    const role = raw.meta?.role ?? raw.meta?.question_role;
    const transfer = raw.meta?.transfer_level;
    const strictness = raw.meta?.strictness_level;

    const meta: ItemMeta = {
      questionRole:
        role === 'anchor' ||
        role === 'misconception' ||
        role === 'prerequisite_probe' ||
        role === 'transfer' ||
        role === 'shadow' ||
        role === 'practice'
          ? role
          : DEFAULT_META.questionRole,
      misconceptionTag: typeof raw.meta?.misconception_tag === 'string' ? raw.meta.misconception_tag : null,
      route: parseRoute(raw.meta?.route),
      transferLevel:
        transfer === 'none' || transfer === 'low' || transfer === 'medium' || transfer === 'high'
          ? transfer
          : DEFAULT_META.transferLevel,
      strictnessLevel: strictness === 'exact' || strictness === 'normalized' ? strictness : DEFAULT_META.strictnessLevel,
    };

    return { choices, meta };
  }

  return { choices: [], meta: DEFAULT_META };
}

function looksLikeTrueFalseQuestion(question: unknown): boolean {
  if (typeof question !== 'string') return false;
  const text = question.trim();
  return /^(correct|incorrect)\s*:/i.test(text) || /^is this statement (correct|true)\??/i.test(text);
}

function optionsContainBooleanChoices(options: unknown): boolean {
  const parsed = parseItemOptions(options);
  if (parsed.choices.length < 2) return false;
  const normalized = new Set(parsed.choices.map((c) => c.trim().toLowerCase()));
  return (
    (normalized.has('true') && normalized.has('false')) ||
    (normalized.has('correct') && normalized.has('incorrect')) ||
    (normalized.has('yes') && normalized.has('no'))
  );
}

export function parseAnswerType(itemType: unknown, question?: unknown, options?: unknown): AnswerType {
  if (typeof itemType === 'string') {
    const normalized = itemType.trim().toUpperCase();
    if (normalized === 'TRUE_FALSE' || normalized === 'BOOLEAN' || normalized === 'TF') return 'TRUE_FALSE';
    if (normalized === 'SHORT_TEXT' || normalized === 'SHORT') return 'SHORT_TEXT';
    if (normalized === 'SHORT_NUMERIC' || normalized === 'NUMERIC') return 'SHORT_NUMERIC';
  }

  if (looksLikeTrueFalseQuestion(question) || optionsContainBooleanChoices(options)) return 'TRUE_FALSE';
  return 'MCQ';
}
