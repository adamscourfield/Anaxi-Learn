import { describe, expect, it } from 'vitest';
import { selectNextSkill } from '@/features/learn/nextSkill';

const now = new Date('2026-03-13T07:00:00.000Z');

describe('selectNextSkill', () => {
  it('prefers an unlocked skill that has not been started yet', () => {
    const skills = [
      { id: 'a', prerequisites: [] },
      { id: 'b', prerequisites: [] },
    ];

    const masteries = [
      { skillId: 'a', mastery: 0.9, confirmedCount: 2, nextReviewAt: new Date('2026-03-20T07:00:00.000Z') },
    ];

    expect(selectNextSkill(skills, masteries, now)?.id).toBe('b');
  });

  it('prefers the lowest-mastery due skill when everything has been started', () => {
    const skills = [
      { id: 'a', prerequisites: [] },
      { id: 'b', prerequisites: [] },
      { id: 'c', prerequisites: [] },
    ];

    const masteries = [
      { skillId: 'a', mastery: 0.7, confirmedCount: 1, nextReviewAt: new Date('2026-03-12T07:00:00.000Z') },
      { skillId: 'b', mastery: 0.4, confirmedCount: 0, nextReviewAt: new Date('2026-03-12T07:00:00.000Z') },
      { skillId: 'c', mastery: 0.2, confirmedCount: 0, nextReviewAt: new Date('2026-03-20T07:00:00.000Z') },
    ];

    expect(selectNextSkill(skills, masteries, now)?.id).toBe('b');
  });

  it('respects prerequisites when choosing the next skill', () => {
    const skills = [
      { id: 'a', prerequisites: [] },
      { id: 'b', prerequisites: [{ prereqId: 'a' }] },
    ];

    const masteries = [
      { skillId: 'a', mastery: 0.4, confirmedCount: 0, nextReviewAt: new Date('2026-03-20T07:00:00.000Z') },
    ];

    expect(selectNextSkill(skills, masteries, now)?.id).toBe('a');
  });
});
