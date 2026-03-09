import { prisma } from '@/db/prisma';
import { stripStudentQuestionLabel } from '@/features/items/itemMeta';
import { getReteachPlan, type RouteType, type ReteachPlan, type StepType, type VisualType, type StepInteraction } from './reteachContent';

export async function getReteachPlanForSkill(skillId: string, routeType: RouteType): Promise<ReteachPlan> {
  const strictDbMode = process.env.RETEACH_DB_REQUIRED === 'true';

  const route = await prisma.explanationRoute.findUnique({
    where: { skillId_routeType: { skillId, routeType } },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
        include: {
          interactions: {
            orderBy: { sortOrder: 'asc' },
            include: { interactionType: true },
          },
        },
      },
    },
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

      const legacyStepType = asObject?.stepType;
      const legacyVisualType = asObject?.visualType;
      const legacyVisualPayload = asObject?.visualPayload;

      const normalizedInteraction = s.interactions[0]
        ? {
            type: `${s.interactions[0].interactionType.key}.${s.interactions[0].interactionType.version}` as StepInteraction['type'],
            config: (s.interactions[0].config as Record<string, unknown>) ?? {},
            completionRule: (s.interactions[0].completionRule as Record<string, unknown> | null) ?? undefined,
          }
        : undefined;

      const interaction = normalizedInteraction ??
        ((legacyVisualType as VisualType | undefined) && legacyVisualType !== 'none'
          ? {
              type:
                legacyVisualType === 'place_value_grid'
                  ? 'place_value_select.v1'
                  : legacyVisualType === 'compare_columns'
                    ? 'compare_columns.v1'
                    : legacyVisualType === 'decompose_number'
                      ? 'decompose_number.v1'
                      : 'none',
              config: (legacyVisualPayload as Record<string, unknown> | undefined) ?? {},
            }
          : { type: 'none' as const });

      const visualType: VisualType =
        interaction.type === 'place_value_select.v1'
          ? 'place_value_grid'
          : interaction.type === 'compare_columns.v1'
            ? 'compare_columns'
            : interaction.type === 'decompose_number.v1'
              ? 'decompose_number'
              : ((legacyVisualType as VisualType | undefined) ?? 'none');

      const clean = (v: unknown) => stripStudentQuestionLabel(v);
      const cleanedOptions = checkpointOptions.map((o) => clean(o)).filter((o) => o.length > 0);
      const cleanedAnswer = clean(s.checkpointAnswer);

      return {
        title: clean(s.title),
        explanation: clean(s.explanation),
        checkpointQuestion: clean(s.checkpointQuestion),
        checkpointOptions: cleanedOptions,
        checkpointAnswer: cleanedAnswer || s.checkpointAnswer,
        alternativeHint: s.alternativeHint ?? undefined,
        stepType: (s.stepType as StepType | undefined) ?? (legacyStepType as StepType | undefined) ?? 'checkpoint',
        visualType,
        visualPayload:
          (interaction.config as Record<string, unknown> | undefined) ??
          ((legacyVisualPayload as Record<string, unknown> | undefined) ?? undefined),
        interaction,
      };
    }),
  };
}
