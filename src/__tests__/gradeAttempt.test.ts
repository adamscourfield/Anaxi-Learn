import { describe, it, expect } from 'vitest';
import { getItemContent, gradeAttempt, normalizeAnswer } from '@/features/learn/itemContent';

describe('gradeAttempt', () => {
  it('returns true for correct answer', () => {
    expect(gradeAttempt(['Paris'], 'Paris')).toBe(true);
  });

  it('returns false for incorrect answer', () => {
    expect(gradeAttempt(['Paris'], 'London')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(gradeAttempt(['Paris'], 'paris')).toBe(true);
  });

  it('trims whitespace', () => {
    expect(gradeAttempt(['Paris'], '  Paris  ')).toBe(true);
  });

  it('accepts equivalent numeric formats', () => {
    expect(gradeAttempt(['1000'], '1,000')).toBe(true);
  });

  it('accepts alternate marked answers from item metadata', () => {
    const item = getItemContent({
      type: 'SHORT_TEXT',
      answer: 't is less than 3',
      options: {
        acceptedAnswers: ['t is less than 3', '3 is greater than t'],
      },
    });

    expect(gradeAttempt(item.acceptedAnswers, '3 is greater than t')).toBe(true);
  });

  it('normalizes ordered answers consistently', () => {
    expect(normalizeAnswer('2°C, 7°C, 8°C')).toBe(normalizeAnswer('2°C | 7°C | 8°C'));
  });

  it('accepts comma variations in numeric-text answers', () => {
    expect(gradeAttempt('6,000,000 + 40,000 + 70', '6000000 + 40000 + 70')).toBe(true);
  });

  it('normalizes boolean synonyms', () => {
    expect(gradeAttempt('True', 'yes')).toBe(true);
    expect(gradeAttempt('False', 'incorrect')).toBe(true);
  });

  it('normalizes ampersand and and consistently', () => {
    expect(gradeAttempt('one hundred and five', 'one hundred & five')).toBe(true);
  });

  it('normalizes diacritics for short text answers', () => {
    expect(gradeAttempt('cafe', 'café')).toBe(true);
  });

  it('supports multiple accepted answers split by semicolon/pipe/newline', () => {
    expect(gradeAttempt('4;four|IV\n 04 ', 'iv')).toBe(true);
  });
});
