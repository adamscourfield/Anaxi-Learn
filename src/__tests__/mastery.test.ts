import { describe, it, expect } from 'vitest';
import {
  calculateMastery,
  scheduleNextReview,
  isSkillStable,
  MASTERY_STABLE_THRESHOLD,
  MASTERY_IMPROVING_THRESHOLD,
} from '@/features/mastery/masteryService';

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
  const now = new Date('2024-01-01T12:00:00Z');

  it('schedules 1 day when mastery < 0.6', () => {
    const next = scheduleNextReview(0.5, 0, now);
    expect(next.toISOString()).toBe('2024-01-02T12:00:00.000Z');
  });

  it('schedules 3 days when mastery in [0.6, 0.85)', () => {
    const next = scheduleNextReview(0.7, 0, now);
    expect(next.toISOString()).toBe('2024-01-04T12:00:00.000Z');
  });

  it('schedules 7 days when mastery >= 0.85 and confirmedCount < 2', () => {
    const next = scheduleNextReview(0.9, 1, now);
    expect(next.toISOString()).toBe('2024-01-08T12:00:00.000Z');
  });

  it('schedules 14 days when mastery >= 0.85 and confirmedCount >= 2', () => {
    const next = scheduleNextReview(1.0, 2, now);
    expect(next.toISOString()).toBe('2024-01-15T12:00:00.000Z');
  });

  it('schedules 3 days at exactly mastery = 0.6', () => {
    const next = scheduleNextReview(0.6, 0, now);
    expect(next.toISOString()).toBe('2024-01-04T12:00:00.000Z');
  });

  it('schedules 7 days at exactly mastery = 0.85 with confirmedCount 0', () => {
    const next = scheduleNextReview(MASTERY_STABLE_THRESHOLD, 0, now);
    expect(next.toISOString()).toBe('2024-01-08T12:00:00.000Z');
  });

  it('returns a future date', () => {
    const next = scheduleNextReview(0, 0);
    expect(next > new Date()).toBe(true);
  });
});

describe('isSkillStable', () => {
  it('returns true when mastery >= 0.85 and confirmedCount >= 2', () => {
    expect(isSkillStable(0.85, 2)).toBe(true);
    expect(isSkillStable(1.0, 3)).toBe(true);
  });

  it('returns false when mastery < 0.85', () => {
    expect(isSkillStable(0.8, 2)).toBe(false);
  });

  it('returns false when confirmedCount < 2', () => {
    expect(isSkillStable(0.9, 1)).toBe(false);
    expect(isSkillStable(0.9, 0)).toBe(false);
  });
});

describe('constants', () => {
  it('MASTERY_STABLE_THRESHOLD is 0.85', () => {
    expect(MASTERY_STABLE_THRESHOLD).toBe(0.85);
  });

  it('MASTERY_IMPROVING_THRESHOLD is 0.6', () => {
    expect(MASTERY_IMPROVING_THRESHOLD).toBe(0.6);
  });
});
