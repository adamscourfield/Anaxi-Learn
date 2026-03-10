import { z } from 'zod';
import { RETEACH_CONFIG } from './reteachConfig';

export const reteachPolicyNumericSchema = z.object({
  checkpointAccuracyTrigger: z.number().min(0).max(1),
  wrongFirstDifferenceTrigger: z.number().min(0).max(1),
  interactionPassTrigger: z.number().min(0).max(1),
  dleTrendTrigger: z.number().min(-1).max(1),
  gateConsecutiveIndependentCorrect: z.number().int().min(1).max(10),
  gateIndependentRateWindow: z.number().int().min(1).max(20),
  gateIndependentRateMin: z.number().min(0).max(1),
  gateEscalateAfterFailedLoops: z.number().int().min(1).max(10),
});

export const reteachPolicyV1Schema = reteachPolicyNumericSchema.extend({
  policyVersion: z.literal('v1').optional(),
});

export const reteachPolicyV2Schema = reteachPolicyNumericSchema.extend({
  policyVersion: z.literal('v2'),
});

export const reteachPolicyWriteSchema = z.union([reteachPolicyV1Schema, reteachPolicyV2Schema]);

export type ReteachPolicyVersion = 'v1' | 'v2';

export type ReteachPolicy = z.infer<typeof reteachPolicyNumericSchema> & {
  policyVersion: ReteachPolicyVersion;
};

export function getDefaultReteachPolicy(version: ReteachPolicyVersion = 'v1'): ReteachPolicy {
  return {
    policyVersion: version,
    checkpointAccuracyTrigger: RETEACH_CONFIG.checkpointAccuracyTrigger,
    wrongFirstDifferenceTrigger: RETEACH_CONFIG.wrongFirstDifferenceTrigger,
    interactionPassTrigger: RETEACH_CONFIG.interactionPassTrigger,
    dleTrendTrigger: RETEACH_CONFIG.dleTrendTrigger,
    gateConsecutiveIndependentCorrect: RETEACH_CONFIG.gateConsecutiveIndependentCorrect,
    gateIndependentRateWindow: RETEACH_CONFIG.gateIndependentRateWindow,
    gateIndependentRateMin: RETEACH_CONFIG.gateIndependentRateMin,
    gateEscalateAfterFailedLoops: RETEACH_CONFIG.gateEscalateAfterFailedLoops,
  };
}

export function parsePersistedReteachPolicy(payload: unknown): ReteachPolicy {
  const v2Parsed = reteachPolicyV2Schema.safeParse(payload);
  if (v2Parsed.success) return v2Parsed.data;

  const v1Parsed = reteachPolicyV1Schema.safeParse(payload);
  if (v1Parsed.success) {
    return {
      ...v1Parsed.data,
      policyVersion: 'v1',
    };
  }

  return getDefaultReteachPolicy('v1');
}
