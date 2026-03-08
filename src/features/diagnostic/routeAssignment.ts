import { prisma } from '@/db/prisma';
import { nextFallbackRoute, selectN11Route, type N11Route } from './n11RouteLogic';

interface RouteSelectionResult {
  routeType: N11Route;
  reason: string;
  source: 'diagnostic_signals' | 'fallback_chain' | 'history_default';
  interventionRecommended?: boolean;
}

export async function selectExplanationRoute(
  userId: string,
  subjectId: string,
  skillId: string,
  skillCode: string
): Promise<RouteSelectionResult> {
  const [lastShadowFailure, lastAssignedRoute] = await Promise.all([
    prisma.event.findFirst({
      where: {
        name: 'shadow_pair_failed',
        studentUserId: userId,
        subjectId,
        skillId,
      },
      orderBy: { createdAt: 'desc' },
      select: { payload: true },
    }),
    prisma.event.findFirst({
      where: {
        name: 'explanation_route_assigned',
        studentUserId: userId,
        subjectId,
        skillId,
      },
      orderBy: { createdAt: 'desc' },
      select: { payload: true },
    }),
  ]);

  const failedRoute = (lastShadowFailure?.payload as { routeType?: N11Route } | undefined)?.routeType;
  if (failedRoute) {
    const next = nextFallbackRoute(failedRoute);
    if (next !== 'INTERVENTION') {
      return {
        routeType: next,
        reason: `Fallback after failed route ${failedRoute}`,
        source: 'fallback_chain',
      };
    }
    return {
      routeType: 'C',
      reason: 'Fallback chain exhausted; keep highest-support route and flag intervention',
      source: 'fallback_chain',
      interventionRecommended: true,
    };
  }

  if (skillCode.toUpperCase() === 'N1.1') {
    const recentDiagnostic = await prisma.event.findMany({
      where: {
        name: 'attempt_graded',
        studentUserId: userId,
        subjectId,
        skillId,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { payload: true },
    });

    const misconceptionTags = recentDiagnostic
      .map((e) => (e.payload as { misconceptionTag?: string } | undefined)?.misconceptionTag)
      .filter((t): t is string => Boolean(t));

    if (misconceptionTags.length > 0) {
      const routeType = selectN11Route({ misconceptionTags });
      return {
        routeType,
        reason: `Selected from diagnostic misconception tags (${[...new Set(misconceptionTags)].join(', ')})`,
        source: 'diagnostic_signals',
      };
    }
  }

  const prior = (lastAssignedRoute?.payload as { routeType?: N11Route } | undefined)?.routeType;
  if (prior) {
    return {
      routeType: prior,
      reason: `Reusing previous route ${prior}`,
      source: 'history_default',
    };
  }

  return {
    routeType: 'A',
    reason: 'Default route (no prior signals)',
    source: 'history_default',
  };
}
