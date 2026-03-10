function parseNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const RETEACH_CONFIG = {
  checkpointAccuracyTrigger: parseNumber(process.env.RETEACH_TRIGGER_CHECKPOINT_ACCURACY, 0.7),
  wrongFirstDifferenceTrigger: parseNumber(process.env.RETEACH_TRIGGER_WRONG_FIRST_DIFF, 0.35),
  interactionPassTrigger: parseNumber(process.env.RETEACH_TRIGGER_INTERACTION_PASS, 0.75),
  dleTrendTrigger: parseNumber(process.env.RETEACH_TRIGGER_DLE_TREND, -0.12),
  gateConsecutiveIndependentCorrect: parseNumber(process.env.RETEACH_GATE_CONSECUTIVE_CORRECT, 2),
  gateIndependentRateWindow: parseNumber(process.env.RETEACH_GATE_INDEPENDENT_WINDOW, 5),
  gateIndependentRateMin: parseNumber(process.env.RETEACH_GATE_INDEPENDENT_RATE_MIN, 0.8),
  gateEscalateAfterFailedLoops: parseNumber(process.env.RETEACH_GATE_ESCALATE_FAILED_LOOPS, 2),
};
