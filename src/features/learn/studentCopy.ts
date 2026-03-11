const INTERNAL_LABELS = [
  /explanation route\s+[a-z]/gi,
  /\bdle\b/gi,
  /\bat risk\b/gi,
];

export function sanitizeStudentCopy(value: string | null | undefined): string | null {
  if (!value) return null;

  const cleaned = INTERNAL_LABELS.reduce((acc, pattern) => acc.replace(pattern, ''), value)
    .replace(/\s{2,}/g, ' ')
    .replace(/\(\s*\)/g, '')
    .trim();

  return cleaned || null;
}
