import { MASTERY_STABLE_THRESHOLD } from '@/features/mastery/masteryService';

export interface SkillMasteryEntry {
  skillId: string;
  mastery: number;
  confirmedCount: number;
}

export interface SkillPrereqEdge {
  skillId: string;
  prereqId: string;
}

/**
 * Returns true if a skill is unlocked: all its prerequisites have stable mastery.
 * A skill with no prerequisites is always unlocked.
 */
export function isSkillUnlocked(
  skillId: string,
  prereqEdges: SkillPrereqEdge[],
  masteryMap: Map<string, SkillMasteryEntry>
): boolean {
  const prereqs = prereqEdges.filter((e) => e.skillId === skillId);
  if (prereqs.length === 0) return true;

  return prereqs.every((edge) => {
    const m = masteryMap.get(edge.prereqId);
    if (!m) return false;
    return m.mastery >= MASTERY_STABLE_THRESHOLD && m.confirmedCount >= 2;
  });
}

/**
 * Returns the subset of skills that are currently unlocked for a user.
 */
export function getUnlockedSkillIds(
  skillIds: string[],
  prereqEdges: SkillPrereqEdge[],
  masteryMap: Map<string, SkillMasteryEntry>
): string[] {
  return skillIds.filter((id) => isSkillUnlocked(id, prereqEdges, masteryMap));
}
