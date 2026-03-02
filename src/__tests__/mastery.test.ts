import { describe, it, expect } from 'vitest';
import { calculateMastery, scheduleNextReview } from '@/features/mastery/masteryService';

describe('calculateMastery', () => {
  it('returns 0 when total is 0', () => {
    expect(calculateMastery(0, 0)).toBe(0);
  });

  it('returns 1 when all correct', () => {
    expect(calculateMastery(3, 3)).toBe(1);
  });

  it('returns correct ratio', () => {
    expect(calculateMastery(2, 4)).toBe(0.5);
  });

  it('returns 0 when none correct', () => {
    expect(calculateMastery(0, 5)).toBe(0);
  });
});

describe('scheduleNextReview', () => {
  it('schedules 2 days from now', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const next = scheduleNextReview(now);
    expect(next.toISOString()).toBe('2024-01-03T12:00:00.000Z');
  });

  it('returns a future date', () => {
    const next = scheduleNextReview();
    expect(next > new Date()).toBe(true);
  });
});
