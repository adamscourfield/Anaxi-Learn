import { prisma } from '@/db/prisma';
import { nextFallbackRoute, selectN11Route, type N11Route } from './n11RouteLogic';
import { isRoutedSkill } from '@/features/config/learningConfig';
import { isSkillStable } from '@/features/mastery/masteryService';
import { parseItemOptions } from '@/features/items/itemMeta';

interface RouteSelectionResult {
  routeType: N11Route;
  reason: string;
  source: 'diagnostic_signals' | 'fallback_chain' | 'history_default' | 'secure_fast_pass';
  interventionRecommended?: boolean;
  secureFastPass?: boolean;
  transferSignalPositive?: boolean;
}

export function hasPositiveTransferSignalForAttempts(
  attempts: Array<{ correct: boolean; itemOptions: unknown }>
): boolean {
  return attempts.some((attempt) => {
    if (!attempt.correct) return false;
    const meta = parseItemOptions(attempt.itemOptions).meta;
    return meta.questionRole === 'transfer';
  });
}

export async function selectExplanationRoute(
  userId: string,
  subjectId: string,
  skillId: string,
  skillCode: string
): Promise<RouteSelectionResult> {
  const [lastShadowFailure, lastAssignedRoute, skillMastery] = await Promise.all([
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
    prisma.skillMastery.findUnique({
      where: { userId_skillId: { userId, skillId } },
      select: { mastery: true, confirmedCount: true },
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

  const attemptPayloads = recentDiagnostic.map((e) =>
    (e.payload as { itemId?: string; correct?: boolean; misconceptionTag?: string } | undefined) ?? {}
  );
  const itemIds = Array.from(new Set(attemptPayloads.map((p) => p.itemId).filter((id): id is string => Boolean(id))));

  const relatedItems =
    itemIds.length > 0
      ? await prisma.item.findMany({
          where: { id: { in: itemIds } },
          select: { id: true, options: true },
        })
      : [];

  const optionsByItemId = new Map(relatedItems.map((item) => [item.id, item.options]));
  const transferSignalPositive = hasPositiveTransferSignalForAttempts(
    attemptPayloads.map((p) => ({
      correct: p.correct === true,
      itemOptions: p.itemId ? optionsByItemId.get(p.itemId) : undefined,
    }))
  );

  if (skillMastery && isSkillStable(skillMastery.mastery, skillMastery.confirmedCount) && transferSignalPositive) {
    return {
      routeType: 'A',
      reason: 'Secure fast-pass (stable mastery + positive transfer signal)',
      source: 'secure_fast_pass',
      secureFastPass: true,
      transferSignalPositive: true,
    };
  }

  if (isRoutedSkill(skillCode)) {

    const misconceptionTags = recentDiagnostic
      .map((e) => (e.payload as { misconceptionTag?: string } | undefined)?.misconceptionTag)
      .filter((t): t is string => Boolean(t));

    if (misconceptionTags.length > 0) {
      const routeType = selectN11Route({ misconceptionTags });
      return {
        routeType,
        reason: `Selected from diagnostic misconception tags (${[...new Set(misconceptionTags)].join(', ')})`,
        source: 'diagnostic_signals',
        transferSignalPositive,
      };
    }
  }

  const prior = (lastAssignedRoute?.payload as { routeType?: N11Route } | undefined)?.routeType;
  if (prior) {
    return {
      routeType: prior,
      reason: `Reusing previous route ${prior}`,
      source: 'history_default',
      transferSignalPositive,
    };
  }

  return {
    routeType: 'A',
    reason: 'Default route (no prior signals)',
    source: 'history_default',
    transferSignalPositive,
  };
}
