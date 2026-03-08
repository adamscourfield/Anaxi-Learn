export type N1Route = 'A' | 'B' | 'C';

export interface N1DiagnosticOutcome {
  total: number;
  correct: number;
  transferCorrect: boolean;
  misconceptionCounts: {
    pv_m1_place_vs_value?: number;
    pv_m2_zero_shift?: number;
    pv_m3_reading_direction?: number;
    pv_m4_separator_noise?: number;
  };
}

export function decideN1Route(outcome: N1DiagnosticOutcome): { status: 'secure' | 'route'; route?: N1Route; reason: string } {
  if (outcome.correct >= 3 && outcome.transferCorrect) {
    return { status: 'secure', reason: '>=3/4 and transfer correct' };
  }

  const m1 = outcome.misconceptionCounts.pv_m1_place_vs_value ?? 0;
  const m2 = outcome.misconceptionCounts.pv_m2_zero_shift ?? 0;
  const m3 = outcome.misconceptionCounts.pv_m3_reading_direction ?? 0;
  const m4 = outcome.misconceptionCounts.pv_m4_separator_noise ?? 0;

  if (m1 + m2 > m3 + m4) return { status: 'route', route: 'C', reason: 'm1/m2 dominant' };
  if (m3 + m4 > m1 + m2) return { status: 'route', route: 'B', reason: 'm3/m4 dominant' };
  return { status: 'route', route: 'A', reason: 'mixed or unclear signal' };
}

export function nextN1FallbackRoute(current: N1Route): N1Route | null {
  if (current === 'A') return 'B';
  if (current === 'B') return 'C';
  return null;
}
