import { prisma } from '@/db/prisma';
import { RETEACH_CONFIG } from './reteachConfig';

export type EffectiveReteachConfig = typeof RETEACH_CONFIG;

export async function getEffectiveReteachConfig(): Promise<EffectiveReteachConfig> {
  const latest = await prisma.event.findFirst({
    where: { name: 'reteach_policy_updated' },
    orderBy: { createdAt: 'desc' },
    select: { payload: true },
  });

  const payload = (latest?.payload ?? {}) as Partial<EffectiveReteachConfig>;

  return {
    checkpointAccuracyTrigger: payload.checkpointAccuracyTrigger ?? RETEACH_CONFIG.checkpointAccuracyTrigger,
    wrongFirstDifferenceTrigger: payload.wrongFirstDifferenceTrigger ?? RETEACH_CONFIG.wrongFirstDifferenceTrigger,
    interactionPassTrigger: payload.interactionPassTrigger ?? RETEACH_CONFIG.interactionPassTrigger,
    dleTrendTrigger: payload.dleTrendTrigger ?? RETEACH_CONFIG.dleTrendTrigger,
    gateConsecutiveIndependentCorrect:
      payload.gateConsecutiveIndependentCorrect ?? RETEACH_CONFIG.gateConsecutiveIndependentCorrect,
    gateIndependentRateWindow: payload.gateIndependentRateWindow ?? RETEACH_CONFIG.gateIndependentRateWindow,
    gateIndependentRateMin: payload.gateIndependentRateMin ?? RETEACH_CONFIG.gateIndependentRateMin,
    gateEscalateAfterFailedLoops:
      payload.gateEscalateAfterFailedLoops ?? RETEACH_CONFIG.gateEscalateAfterFailedLoops,
  };
}
