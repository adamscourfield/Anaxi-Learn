export type QuestionRole = 'anchor' | 'misconception' | 'prerequisite_probe' | 'transfer' | 'shadow' | 'practice';
export type MisconceptionTag = string;
export type TransferLevel = 'none' | 'low' | 'medium' | 'high';
export type StrictnessLevel = 'exact' | 'normalized';
export type AnswerType = 'MCQ' | 'SHORT_TEXT' | 'SHORT_NUMERIC';

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

export function parseAnswerType(itemType: unknown): AnswerType {
  if (typeof itemType !== 'string') return 'MCQ';
  const normalized = itemType.trim().toUpperCase();
  if (normalized === 'SHORT_TEXT' || normalized === 'SHORT') return 'SHORT_TEXT';
  if (normalized === 'SHORT_NUMERIC' || normalized === 'NUMERIC') return 'SHORT_NUMERIC';
  return 'MCQ';
}
