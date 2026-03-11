export type ItemInteractionType = 'MCQ' | 'TRUE_FALSE' | 'SHORT_TEXT' | 'SHORT_NUMERIC' | 'ORDER';

export interface ItemContent {
  type: ItemInteractionType;
  choices: string[];
  acceptedAnswers: string[];
  canonicalAnswer: string;
}

type AcceptedAnswerInput = string | string[];

type RawOptions =
  | string[]
  | {
      choices?: unknown;
      acceptedAnswers?: unknown;
      media?: unknown;
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

function splitAcceptedAnswerString(value: string): string[] {
  return value
    .split(/[;\n|]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeNumericString(value: string): string | null {
  const cleaned = value.replace(/,/g, '').replace(/[−–—]/g, '-').trim();
  if (!/^[-+]?\d*\.?\d+$/.test(cleaned)) return null;

  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric)) return null;
  return numeric.toString();
}

export function normalizeAnswer(value: string): string {
  const trimmed = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[−–—]/g, '-')
    .replace(/&/g, ' and ')
    .replace(/(?<=\d),(?=\d)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const lowered = trimmed.toLowerCase();

  if (lowered === 'yes' || lowered === 'correct') return 'true';
  if (lowered === 'no' || lowered === 'incorrect') return 'false';

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

function normalizeAcceptedAnswers(input: AcceptedAnswerInput): string[] {
  if (Array.isArray(input)) {
    return unique(
      input
        .flatMap((value) => splitAcceptedAnswerString(value))
        .map((value) => value.trim())
        .filter(Boolean)
    );
  }

  return unique(splitAcceptedAnswerString(input));
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
  acceptedAnswers: AcceptedAnswerInput,
  submittedAnswer: string
): boolean {
  const submitted = normalizeAnswer(submittedAnswer);
  return normalizeAcceptedAnswers(acceptedAnswers).some((answer) => normalizeAnswer(answer) === submitted);
}

export function getAnswerFormatHint(type: string, question: string, options?: unknown): string | null {
  const content = getItemContent({ type, question, answer: '', options } as { type: string; question: string; answer: string; options?: unknown });

  switch (content.type) {
    case 'TRUE_FALSE':
      return 'Answer with True or False.';
    case 'SHORT_NUMERIC':
      return 'Enter digits only, without extra words.';
    case 'ORDER':
      return 'Drag the values into the correct order.';
    case 'SHORT_TEXT':
      return 'Type a short answer using words or symbols only as needed.';
    default:
      return null;
  }
}
