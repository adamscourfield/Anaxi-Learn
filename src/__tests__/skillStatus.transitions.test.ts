import { describe, expect, it } from 'vitest';
import { deriveSkillStatus } from '@/features/mastery/skillStatus';

describe('skill status transitions', () => {
  it('maps mastery bands to NOT_YET / DEVELOPING / SECURE correctly', () => {
    expect(deriveSkillStatus(0.59, 0)).toBe('NOT_YET');
    expect(deriveSkillStatus(0.6, 0)).toBe('DEVELOPING');
    expect(deriveSkillStatus(0.84, 1)).toBe('DEVELOPING');
    expect(deriveSkillStatus(0.85, 1)).toBe('DEVELOPING');
    expect(deriveSkillStatus(0.85, 2)).toBe('SECURE');
  });

  it('follows expected transition path across repeated attempts', () => {
    // Start below improving threshold.
    expect(deriveSkillStatus(0.4, 0)).toBe('NOT_YET');

    // First improvement crosses developing threshold.
    expect(deriveSkillStatus(0.7, 0)).toBe('DEVELOPING');

    // High mastery without enough confirmations remains developing.
    expect(deriveSkillStatus(0.92, 1)).toBe('DEVELOPING');

    // High mastery with confirmations reaches secure.
    expect(deriveSkillStatus(0.92, 2)).toBe('SECURE');
  });

  it('drops from secure when mastery falls under stable threshold', () => {
    expect(deriveSkillStatus(0.9, 2)).toBe('SECURE');
    expect(deriveSkillStatus(0.8, 2)).toBe('DEVELOPING');
    expect(deriveSkillStatus(0.5, 2)).toBe('NOT_YET');
  });
});
