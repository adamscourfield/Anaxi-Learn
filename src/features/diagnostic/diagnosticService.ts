// Strand quotas for diagnostic coverage
export const STRAND_QUOTAS: Record<string, number> = {
  PV: 3,
  ADD: 3,
  MUL: 3,
  FAC: 1,
  FDP: 2,
};

export const DIAGNOSTIC_STRANDS = Object.keys(STRAND_QUOTAS);

export interface SkillEstimate {
  skillCode: string;
  strand: string;
  correct: number;
  total: number;
  masteryEstimate: number;
}

export interface DiagnosticPayload {
  estimates: Record<string, SkillEstimate>;
  strandCounts: Record<string, number>; // how many items shown per strand
  skillSignals?: Record<
    string,
    {
      transferCorrect: boolean;
      misconceptionCounts: Record<string, number>;
    }
  >;
  routeRecommendations?: Record<string, { status: 'secure' | 'route'; route?: 'A' | 'B' | 'C'; reason: string }>;
}

export function initPayload(): DiagnosticPayload {
  return { estimates: {}, strandCounts: {}, skillSignals: {}, routeRecommendations: {} };
}

export function updatePayloadAfterAttempt(
  payload: DiagnosticPayload,
  skillCode: string,
  strand: string,
  correct: boolean,
  signal?: { misconceptionTag?: string | null; isTransfer?: boolean }
): DiagnosticPayload {
  const est = payload.estimates[skillCode] ?? {
    skillCode,
    strand,
    correct: 0,
    total: 0,
    masteryEstimate: 0,
  };
  const newTotal = est.total + 1;
  const newCorrect = est.correct + (correct ? 1 : 0);
  const updated: SkillEstimate = {
    ...est,
    total: newTotal,
    correct: newCorrect,
    masteryEstimate: newTotal > 0 ? newCorrect / newTotal : 0,
  };
  const strandCounts = { ...payload.strandCounts };
  strandCounts[strand] = (strandCounts[strand] ?? 0) + 1;
  const skillSignals = { ...(payload.skillSignals ?? {}) };
  const existingSignal = skillSignals[skillCode] ?? { transferCorrect: false, misconceptionCounts: {} };

  const misconceptionCounts = { ...existingSignal.misconceptionCounts };
  if (!correct && signal?.misconceptionTag) {
    misconceptionCounts[signal.misconceptionTag] = (misconceptionCounts[signal.misconceptionTag] ?? 0) + 1;
  }

  skillSignals[skillCode] = {
    transferCorrect: existingSignal.transferCorrect || Boolean(signal?.isTransfer && correct),
    misconceptionCounts,
  };

  return {
    estimates: { ...payload.estimates, [skillCode]: updated },
    strandCounts,
    skillSignals,
    routeRecommendations: { ...(payload.routeRecommendations ?? {}) },
  };
}

/**
 * Select the next skill to assess.
 * Priority:
 * 1. Skills in STRAND_QUOTAS strands that haven't met their quota yet (lowest masteryEstimate first)
 * 2. Among skills that met quota, lowest masteryEstimate
 */
export function selectNextSkill(
  availableSkills: Array<{ id: string; code: string; strand: string }>,
  payload: DiagnosticPayload
): { id: string; code: string; strand: string } | null {
  if (availableSkills.length === 0) return null;

  // Check which quota strands still need items
  const underQuota = availableSkills.filter((s) => {
    const quota = STRAND_QUOTAS[s.strand];
    if (!quota) return false;
    const seen = payload.strandCounts[s.strand] ?? 0;
    return seen < quota;
  });

  const pool = underQuota.length > 0 ? underQuota : availableSkills;

  // Sort by masteryEstimate ascending (lowest first)
  const sorted = [...pool].sort((a, b) => {
    const ma = payload.estimates[a.code]?.masteryEstimate ?? 0;
    const mb = payload.estimates[b.code]?.masteryEstimate ?? 0;
    return ma - mb;
  });

  return sorted[0] ?? null;
}

/**
 * Early stopping rule:
 * After minItems, if for each of PV/ADD/MUL the mean masteryEstimate >= confidenceTarget
 * AND overall accuracy >= confidenceTarget → stop early
 */
export function shouldStopEarly(
  payload: DiagnosticPayload,
  itemsSeen: number,
  minItems: number,
  maxItems: number,
  confidenceTarget: number
): boolean {
  if (itemsSeen < minItems) return false;
  if (itemsSeen >= maxItems) return true;

  // Check core strands
  for (const strand of ['PV', 'ADD', 'MUL']) {
    const skills = Object.values(payload.estimates).filter((e) => e.strand === strand);
    if (skills.length === 0) return false;
    const mean = skills.reduce((s, e) => s + e.masteryEstimate, 0) / skills.length;
    if (mean < confidenceTarget) return false;
  }

  // Overall accuracy
  const all = Object.values(payload.estimates);
  const totalItems = all.reduce((s, e) => s + e.total, 0);
  const totalCorrect = all.reduce((s, e) => s + e.correct, 0);
  if (totalItems === 0) return false;
  const overallAccuracy = totalCorrect / totalItems;
  return overallAccuracy >= confidenceTarget;
}
