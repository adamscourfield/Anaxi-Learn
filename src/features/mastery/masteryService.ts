export const MASTERY_STABLE_THRESHOLD = 0.85;
export const MASTERY_IMPROVING_THRESHOLD = 0.6;

export function calculateMastery(correct: number, total: number): number {
  if (total === 0) return 0;
  return correct / total;
}

export function scheduleNextReview(
  mastery: number,
  confirmedCount: number,
  now: Date = new Date()
): Date {
  const next = new Date(now);
  if (mastery < MASTERY_IMPROVING_THRESHOLD) {
    next.setDate(next.getDate() + 1);
  } else if (mastery < MASTERY_STABLE_THRESHOLD) {
    next.setDate(next.getDate() + 3);
  } else if (confirmedCount < 2) {
    next.setDate(next.getDate() + 7);
  } else {
    next.setDate(next.getDate() + 14);
  }
  return next;
}

export function isSkillStable(mastery: number, confirmedCount: number): boolean {
  return mastery >= MASTERY_STABLE_THRESHOLD && confirmedCount >= 2;
}
