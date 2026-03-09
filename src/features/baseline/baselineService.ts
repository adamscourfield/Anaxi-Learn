export interface BaselineSkillProgress {
  skillId: string;
  skillCode: string;
  sortOrder: number;
  attempts: number;
  correct: number;
  accuracy: number;
  remainingItemIds: string[];
}

export interface BaselineStopDecision {
  shouldStop: boolean;
  reason: string;
}

export function evaluateBaselineStop(params: {
  itemsSeen: number;
  minItems: number;
  maxItems: number;
  confidenceTarget: number;
  skillProgress: BaselineSkillProgress[];
}): BaselineStopDecision {
  const { itemsSeen, minItems, maxItems, confidenceTarget, skillProgress } = params;

  if (itemsSeen >= maxItems) return { shouldStop: true, reason: 'max_items_reached' };
  if (itemsSeen < minItems) return { shouldStop: false, reason: 'below_min_items' };

  const allSkillsSeen = skillProgress.every((s) => s.attempts >= 1);
  if (!allSkillsSeen) return { shouldStop: false, reason: 'breadth_incomplete' };

  const totalAttempts = skillProgress.reduce((a, s) => a + s.attempts, 0);
  const totalCorrect = skillProgress.reduce((a, s) => a + s.correct, 0);
  const overallAccuracy = totalAttempts > 0 ? totalCorrect / totalAttempts : 0;

  if (overallAccuracy >= confidenceTarget) {
    return { shouldStop: true, reason: 'confidence_target_reached' };
  }

  const uncertainSkills = skillProgress.filter(
    (s) => s.attempts < 2 || (s.accuracy >= 0.4 && s.accuracy <= 0.8 && s.attempts < 3)
  );

  if (uncertainSkills.length === 0) {
    return { shouldStop: true, reason: 'uncertainty_reduced' };
  }

  return { shouldStop: false, reason: 'continue_sampling' };
}

export function selectNextSkill(progress: BaselineSkillProgress[]): BaselineSkillProgress | null {
  if (progress.length === 0) return null;

  const breadth = progress
    .filter((s) => s.attempts === 0 && s.remainingItemIds.length > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (breadth.length > 0) return breadth[0];

  const depth = progress
    .filter((s) => s.remainingItemIds.length > 0)
    .sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      if (a.attempts !== b.attempts) return a.attempts - b.attempts;
      return a.sortOrder - b.sortOrder;
    });

  return depth[0] ?? null;
}
