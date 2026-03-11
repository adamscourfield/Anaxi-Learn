export type ItemInteractionType = 'MCQ' | 'TRUE_FALSE' | 'SHORT_TEXT' | 'ORDER';

export interface ItemContent {
  type: ItemInteractionType;
  choices: string[];
  acceptedAnswers: string[];
  canonicalAnswer: string;
}

type RawOptions =
  | string[]
  | {
      choices?: unknown;
      acceptedAnswers?: unknown;
    }
  | null
  | undefined;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeNumericString(value: string): string | null {
  const cleaned = value.replace(/,/g, '').replace(/[−–—]/g, '-').trim();
  if (!/^[-+]?\d*\.?\d+$/.test(cleaned)) return null;

  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric)) return null;
  return numeric.toString();
}

export function normalizeAnswer(value: string): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.includes('|') || trimmed.includes(', ')) {
    return trimmed
      .split(/\s*(?:\||,)\s*/)
      .map((part) => normalizeAnswer(part))
      .join('|');
  }
  const numeric = normalizeNumericString(trimmed);
  if (numeric != null) return numeric;
  return trimmed.toLowerCase();
}

function parseOptions(options: unknown): { choices: string[]; acceptedAnswers: string[] } {
  if (Array.isArray(options)) {
    return { choices: unique(toStringList(options)), acceptedAnswers: [] };
  }

  if (isObject(options)) {
    return {
      choices: unique(toStringList(options.choices)),
      acceptedAnswers: unique(toStringList(options.acceptedAnswers)),
    };
  }

  return { choices: [], acceptedAnswers: [] };
}

export function getItemContent(item: {
  type: string;
  answer: string;
  options?: unknown;
}): ItemContent {
  const parsed = parseOptions(item.options);
  const acceptedAnswers = unique([item.answer, ...parsed.acceptedAnswers]);

  return {
    type: (item.type as ItemInteractionType) || 'MCQ',
    choices: parsed.choices,
    acceptedAnswers,
    canonicalAnswer: item.answer,
  };
}

export function gradeAttempt(
  acceptedAnswers: string[],
  submittedAnswer: string
): boolean {
  const submitted = normalizeAnswer(submittedAnswer);
  return acceptedAnswers.some((answer) => normalizeAnswer(answer) === submitted);
}
