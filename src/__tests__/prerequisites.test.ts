import { describe, it, expect } from 'vitest';
import { isSkillUnlocked, getUnlockedSkillIds } from '@/features/learn/prerequisites';
import type { SkillMasteryEntry, SkillPrereqEdge } from '@/features/learn/prerequisites';

describe('isSkillUnlocked', () => {
  it('unlocks a skill with no prerequisites', () => {
    expect(isSkillUnlocked('skill-A', [], new Map())).toBe(true);
  });

  it('locks a skill when a prereq has no mastery entry', () => {
    const edges: SkillPrereqEdge[] = [{ skillId: 'skill-B', prereqId: 'skill-A' }];
    const masteryMap = new Map<string, SkillMasteryEntry>();
    expect(isSkillUnlocked('skill-B', edges, masteryMap)).toBe(false);
  });

  it('locks a skill when prereq mastery < 0.85', () => {
    const edges: SkillPrereqEdge[] = [{ skillId: 'skill-B', prereqId: 'skill-A' }];
    const masteryMap = new Map<string, SkillMasteryEntry>([
      ['skill-A', { skillId: 'skill-A', mastery: 0.8, confirmedCount: 2 }],
    ]);
    expect(isSkillUnlocked('skill-B', edges, masteryMap)).toBe(false);
  });

  it('locks a skill when prereq confirmedCount < 2', () => {
    const edges: SkillPrereqEdge[] = [{ skillId: 'skill-B', prereqId: 'skill-A' }];
    const masteryMap = new Map<string, SkillMasteryEntry>([
      ['skill-A', { skillId: 'skill-A', mastery: 0.9, confirmedCount: 1 }],
    ]);
    expect(isSkillUnlocked('skill-B', edges, masteryMap)).toBe(false);
  });

  it('unlocks a skill when all prereqs are stable (mastery >= 0.85 and confirmedCount >= 2)', () => {
    const edges: SkillPrereqEdge[] = [{ skillId: 'skill-B', prereqId: 'skill-A' }];
    const masteryMap = new Map<string, SkillMasteryEntry>([
      ['skill-A', { skillId: 'skill-A', mastery: 0.9, confirmedCount: 2 }],
    ]);
    expect(isSkillUnlocked('skill-B', edges, masteryMap)).toBe(true);
  });

  it('requires ALL prereqs to be stable (multiple prereqs)', () => {
    const edges: SkillPrereqEdge[] = [
      { skillId: 'skill-C', prereqId: 'skill-A' },
      { skillId: 'skill-C', prereqId: 'skill-B' },
    ];
    const masteryMap = new Map<string, SkillMasteryEntry>([
      ['skill-A', { skillId: 'skill-A', mastery: 1.0, confirmedCount: 2 }],
      ['skill-B', { skillId: 'skill-B', mastery: 0.7, confirmedCount: 0 }],
    ]);
    expect(isSkillUnlocked('skill-C', edges, masteryMap)).toBe(false);
  });

  it('unlocks when all multiple prereqs are stable', () => {
    const edges: SkillPrereqEdge[] = [
      { skillId: 'skill-C', prereqId: 'skill-A' },
      { skillId: 'skill-C', prereqId: 'skill-B' },
    ];
    const masteryMap = new Map<string, SkillMasteryEntry>([
      ['skill-A', { skillId: 'skill-A', mastery: 1.0, confirmedCount: 3 }],
      ['skill-B', { skillId: 'skill-B', mastery: 0.85, confirmedCount: 2 }],
    ]);
    expect(isSkillUnlocked('skill-C', edges, masteryMap)).toBe(true);
  });
});

describe('getUnlockedSkillIds', () => {
  it('returns all skills that have no prereqs', () => {
    const skillIds = ['A', 'B', 'C'];
    const result = getUnlockedSkillIds(skillIds, [], new Map());
    expect(result).toEqual(['A', 'B', 'C']);
  });

  it('filters out locked skills', () => {
    const skillIds = ['A', 'B'];
    const edges: SkillPrereqEdge[] = [{ skillId: 'B', prereqId: 'A' }];
    const masteryMap = new Map<string, SkillMasteryEntry>();
    const result = getUnlockedSkillIds(skillIds, edges, masteryMap);
    expect(result).toEqual(['A']);
  });

  it('includes a skill once its prereq is stable', () => {
    const skillIds = ['A', 'B'];
    const edges: SkillPrereqEdge[] = [{ skillId: 'B', prereqId: 'A' }];
    const masteryMap = new Map<string, SkillMasteryEntry>([
      ['A', { skillId: 'A', mastery: 0.9, confirmedCount: 2 }],
    ]);
    const result = getUnlockedSkillIds(skillIds, edges, masteryMap);
    expect(result).toEqual(['A', 'B']);
  });
});

describe('confirmedCount retention gate', () => {
  it('skill only unlocks dependents when confirmedCount reaches 2', () => {
    const edges: SkillPrereqEdge[] = [{ skillId: 'child', prereqId: 'parent' }];

    // confirmedCount = 0: locked
    const map0 = new Map<string, SkillMasteryEntry>([
      ['parent', { skillId: 'parent', mastery: 1.0, confirmedCount: 0 }],
    ]);
    expect(isSkillUnlocked('child', edges, map0)).toBe(false);

    // confirmedCount = 1: still locked
    const map1 = new Map<string, SkillMasteryEntry>([
      ['parent', { skillId: 'parent', mastery: 1.0, confirmedCount: 1 }],
    ]);
    expect(isSkillUnlocked('child', edges, map1)).toBe(false);

    // confirmedCount = 2: unlocked
    const map2 = new Map<string, SkillMasteryEntry>([
      ['parent', { skillId: 'parent', mastery: 1.0, confirmedCount: 2 }],
    ]);
    expect(isSkillUnlocked('child', edges, map2)).toBe(true);
  });
});
