import { describe, expect, it } from 'vitest';
import {
  getDefaultReteachPolicy,
  parsePersistedReteachPolicy,
  reteachPolicyWriteSchema,
} from '@/features/reteach/reteachPolicyContract';

describe('reteachPolicyContract', () => {
  it('parses explicit v2 payloads', () => {
    const payload = {
      policyVersion: 'v2' as const,
      checkpointAccuracyTrigger: 0.7,
      wrongFirstDifferenceTrigger: 0.35,
      interactionPassTrigger: 0.75,
      dleTrendTrigger: -0.12,
      gateConsecutiveIndependentCorrect: 2,
      gateIndependentRateWindow: 5,
      gateIndependentRateMin: 0.8,
      gateEscalateAfterFailedLoops: 2,
    };

    expect(reteachPolicyWriteSchema.parse(payload)).toEqual(payload);
    expect(parsePersistedReteachPolicy(payload).policyVersion).toBe('v2');
  });

  it('normalizes legacy payloads to v1', () => {
    const legacy = {
      checkpointAccuracyTrigger: 0.7,
      wrongFirstDifferenceTrigger: 0.35,
      interactionPassTrigger: 0.75,
      dleTrendTrigger: -0.12,
      gateConsecutiveIndependentCorrect: 2,
      gateIndependentRateWindow: 5,
      gateIndependentRateMin: 0.8,
      gateEscalateAfterFailedLoops: 2,
    };

    const normalized = parsePersistedReteachPolicy(legacy);
    expect(normalized.policyVersion).toBe('v1');
    expect(normalized.checkpointAccuracyTrigger).toBe(0.7);
  });

  it('falls back to defaults when payload is invalid', () => {
    const normalized = parsePersistedReteachPolicy({ policyVersion: 'v2', checkpointAccuracyTrigger: 999 });
    expect(normalized).toEqual(getDefaultReteachPolicy('v1'));
  });
});
