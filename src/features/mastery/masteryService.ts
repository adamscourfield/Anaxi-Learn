export const REVIEW_INTERVAL_DAYS = 2;

export function calculateMastery(correct: number, total: number): number {
  if (total === 0) return 0;
  return correct / total;
}

export function scheduleNextReview(now: Date = new Date()): Date {
  const next = new Date(now);
  next.setDate(next.getDate() + REVIEW_INTERVAL_DAYS);
  return next;
}
