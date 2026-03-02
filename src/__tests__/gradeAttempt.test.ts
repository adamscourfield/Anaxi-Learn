import { describe, it, expect } from 'vitest';
import { gradeAttempt } from '@/features/learn/gradeAttempt';

describe('gradeAttempt', () => {
  it('returns true for correct answer', () => {
    expect(gradeAttempt('Paris', 'Paris')).toBe(true);
  });

  it('returns false for incorrect answer', () => {
    expect(gradeAttempt('Paris', 'London')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(gradeAttempt('Paris', 'paris')).toBe(true);
  });

  it('trims whitespace', () => {
    expect(gradeAttempt('Paris', '  Paris  ')).toBe(true);
  });
});
