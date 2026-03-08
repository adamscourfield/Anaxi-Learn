import { describe, expect, it } from 'vitest';
import { decideN1Route, nextN1FallbackRoute } from '@/features/diagnostic/n1Routing';

describe('N1 routing', () => {
  it('returns secure on >=3/4 with transfer true', () => {
    const decision = decideN1Route({
      total: 4,
      correct: 3,
      transferCorrect: true,
      misconceptionCounts: {},
    });
    expect(decision.status).toBe('secure');
  });

  it('routes C when m1/m2 dominant', () => {
    const decision = decideN1Route({
      total: 4,
      correct: 1,
      transferCorrect: false,
      misconceptionCounts: { pv_m2_zero_shift: 2 },
    });
    expect(decision).toMatchObject({ status: 'route', route: 'C' });
  });

  it('routes B when m3/m4 dominant', () => {
    const decision = decideN1Route({
      total: 4,
      correct: 1,
      transferCorrect: false,
      misconceptionCounts: { pv_m3_reading_direction: 2 },
    });
    expect(decision).toMatchObject({ status: 'route', route: 'B' });
  });

  it('falls back to A for mixed/unclear', () => {
    const decision = decideN1Route({
      total: 4,
      correct: 2,
      transferCorrect: false,
      misconceptionCounts: { pv_m2_zero_shift: 1, pv_m3_reading_direction: 1 },
    });
    expect(decision).toMatchObject({ status: 'route', route: 'A' });
  });

  it('follows route fallback chain A -> B -> C -> null', () => {
    expect(nextN1FallbackRoute('A')).toBe('B');
    expect(nextN1FallbackRoute('B')).toBe('C');
    expect(nextN1FallbackRoute('C')).toBeNull();
  });
});
