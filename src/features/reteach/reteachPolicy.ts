import { prisma } from '@/db/prisma';
import {
  getDefaultReteachPolicy,
  parsePersistedReteachPolicy,
  type ReteachPolicy,
} from './reteachPolicyContract';

export type EffectiveReteachConfig = ReteachPolicy;

export async function getEffectiveReteachConfig(): Promise<EffectiveReteachConfig> {
  const latest = await prisma.event.findFirst({
    where: { name: 'reteach_policy_updated' },
    orderBy: { createdAt: 'desc' },
    select: { payload: true },
  });

  if (!latest?.payload) {
    return getDefaultReteachPolicy('v1');
  }

  return parsePersistedReteachPolicy(latest.payload);
}
