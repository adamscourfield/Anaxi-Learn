export const featureFlags = {
  phase9ReteachV1:
    process.env.NEXT_PUBLIC_PHASE9_RETEACH_V1 === 'true' || process.env.PHASE9_RETEACH_V1 === 'true',
};
