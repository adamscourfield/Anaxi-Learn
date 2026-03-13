import { isSkillUnlocked } from '@/features/learn/prerequisites';

interface SkillLike {
  id: string;
  prerequisites?: Array<{ prereqId: string }>;
}

interface MasteryLike {
  skillId: string;
  mastery: number;
  confirmedCount: number;
  nextReviewAt: Date | null;
}

export function selectNextSkill<T extends SkillLike>(skills: T[], masteries: MasteryLike[], now = new Date()): T | null {
  if (skills.length === 0) return null;

  const masteryMap = new Map(
    masteries.map((m) => [
      m.skillId,
      {
        skillId: m.skillId,
        mastery: m.mastery,
        confirmedCount: m.confirmedCount,
        nextReviewAt: m.nextReviewAt,
      },
    ])
  );

  const prereqEdges = skills.flatMap((skill) =>
    (skill.prerequisites ?? []).map((prereq) => ({ skillId: skill.id, prereqId: prereq.prereqId }))
  );

  const unlockedSkills = skills.filter((skill) => isSkillUnlocked(skill.id, prereqEdges, masteryMap));

  if (unlockedSkills.length === 0) return null;

  const neverStarted = unlockedSkills.find((skill) => {
    const mastery = masteryMap.get(skill.id);
    return !mastery || !mastery.nextReviewAt;
  });

  if (neverStarted) return neverStarted;

  const dueSkills = unlockedSkills.filter((skill) => {
    const mastery = masteryMap.get(skill.id);
    return mastery?.nextReviewAt && mastery.nextReviewAt <= now;
  });

  const pool = dueSkills.length > 0 ? dueSkills : unlockedSkills;

  return [...pool].sort((a, b) => {
    const masteryA = masteryMap.get(a.id)?.mastery ?? 0;
    const masteryB = masteryMap.get(b.id)?.mastery ?? 0;
    return masteryA - masteryB;
  })[0] ?? null;
}
