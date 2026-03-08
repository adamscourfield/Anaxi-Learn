import { prisma } from '@/db/prisma';
import { getReteachPlan, type RouteType, type ReteachPlan, type StepType, type VisualType } from './reteachContent';

export async function getReteachPlanForSkill(skillId: string, routeType: RouteType): Promise<ReteachPlan> {
  const strictDbMode = process.env.RETEACH_DB_REQUIRED === 'true';

  const route = await prisma.explanationRoute.findUnique({
    where: { skillId_routeType: { skillId, routeType } },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
  });

  if (!route || route.steps.length === 0) {
    if (strictDbMode) {
      throw new Error(
        `Missing DB reteach content for skillId=${skillId}, routeType=${routeType}. Set RETEACH_DB_REQUIRED=false to allow fallback.`
      );
    }
    return getReteachPlan(routeType);
  }

  return {
    misconceptionSummary: route.misconceptionSummary,
    workedExample: route.workedExample,
    guidedPrompt: route.guidedPrompt,
    guidedAnswer: route.guidedAnswer,
    steps: route.steps.map((s) => {
      const raw = s.checkpointOptions as unknown;
      const asArray = Array.isArray(raw) ? raw : null;
      const asObject = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;

      const checkpointOptions = asArray
        ? asArray.filter((o): o is string => typeof o === 'string')
        : Array.isArray(asObject?.options)
          ? (asObject?.options as unknown[]).filter((o): o is string => typeof o === 'string')
          : [];

      const stepType = asObject?.stepType;
      const visualType = asObject?.visualType;
      const visualPayload = asObject?.visualPayload;

      return {
        title: s.title,
        explanation: s.explanation,
        checkpointQuestion: s.checkpointQuestion,
        checkpointOptions,
        checkpointAnswer: s.checkpointAnswer,
        alternativeHint: s.alternativeHint ?? undefined,
        stepType: (stepType as StepType | undefined) ?? 'checkpoint',
        visualType: (visualType as VisualType | undefined) ?? 'none',
        visualPayload: (visualPayload as Record<string, unknown> | undefined) ?? undefined,
      };
    }),
  };
}
