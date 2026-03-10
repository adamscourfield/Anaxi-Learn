import { describe, expect, it } from 'vitest';
import { nextFallbackRoute, selectN11Route } from '@/features/diagnostic/n11RouteLogic';
import { deriveSkillStatus } from '@/features/mastery/skillStatus';

describe('N1.1 persona harness', () => {
  it('P1 secure learner: route A and reaches secure status with confirmations', () => {
    // Unclear/mixed diagnostic signals default to route A.
    expect(selectN11Route({ misconceptionTags: [] })).toBe('A');

    // Mastery trajectory reaches secure when stable threshold + confirmations met.
    expect(deriveSkillStatus(0.7, 0)).toBe('DEVELOPING');
    expect(deriveSkillStatus(0.9, 1)).toBe('DEVELOPING');
    expect(deriveSkillStatus(0.9, 2)).toBe('SECURE');
  });

  it('P2 misconception learner: m1/m2 routes to C and can still recover to secure', () => {
    expect(selectN11Route({ misconceptionTags: ['m1'] })).toBe('C');
    expect(selectN11Route({ misconceptionTags: ['m2'] })).toBe('C');

    // After support and successful attempts, status can progress.
    expect(deriveSkillStatus(0.65, 0)).toBe('DEVELOPING');
    expect(deriveSkillStatus(0.88, 2)).toBe('SECURE');
  });

  it('P3 persistent failure: fallback reaches intervention after C fails', () => {
    // Failed A -> B, failed B -> C, failed C -> intervention.
    expect(nextFallbackRoute('A')).toBe('B');
    expect(nextFallbackRoute('B')).toBe('C');
    expect(nextFallbackRoute('C')).toBe('INTERVENTION');
  });
});
