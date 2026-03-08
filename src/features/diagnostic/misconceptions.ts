export type N11MisconceptionTag = 'm1' | 'm2' | 'm3' | 'm4';

/**
 * Lightweight MVP mapper for N1.1 diagnostics.
 * We map answer choice slot -> misconception family so route selection has signals.
 */
export function inferN11MisconceptionTag(
  skillCode: string,
  selectedAnswer: string,
  options: string[],
  correct: boolean
): N11MisconceptionTag | undefined {
  if (skillCode.toUpperCase() !== 'N1.1') return undefined;
  if (correct) return undefined;

  const index = options.findIndex((o) => o === selectedAnswer);
  if (index === 0) return 'm1';
  if (index === 1) return 'm2';
  if (index === 2) return 'm3';
  if (index === 3) return 'm4';
  return undefined;
}
