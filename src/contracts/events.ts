import { z } from 'zod';

export const AttemptSubmittedPayloadSchema = z.object({
  itemId: z.string(),
  answer: z.string(),
  skillId: z.string(),
  skillCode: z.string().optional(),
  strand: z.string().optional(),
  subjectId: z.string(),
  misconceptionTag: z.string().optional(),
});

export const AttemptGradedPayloadSchema = z.object({
  itemId: z.string(),
  attemptId: z.string(),
  correct: z.boolean(),
  skillId: z.string(),
  skillCode: z.string().optional(),
  strand: z.string().optional(),
  subjectId: z.string(),
  misconceptionTag: z.string().optional(),
});

export const SkillStateUpdatedPayloadSchema = z.object({
  skillId: z.string(),
  skillCode: z.string().optional(),
  strand: z.string().optional(),
  mastery: z.number().min(0).max(1),
  confirmedCount: z.number().int().min(0).optional(),
  lastPracticedAt: z.string(),
  nextReviewAt: z.string(),
});

export const ReviewScheduledPayloadSchema = z.object({
  skillId: z.string(),
  skillCode: z.string().optional(),
  strand: z.string().optional(),
  nextReviewAt: z.string(),
});

export const ReviewCompletedPayloadSchema = z.object({
  skillId: z.string(),
  skillCode: z.string().optional(),
  strand: z.string().optional(),
  mastery: z.number().min(0).max(1),
});

export const DiagnosticCompletedPayloadSchema = z.object({
  sessionId: z.string(),
  subjectSlug: z.string(),
  itemsSeen: z.number(),
});

export const InterventionRecommendedPayloadSchema = z.object({
  skillId: z.string(),
  reason: z.string(),
  recentAttempts: z.number(),
  mastery: z.number(),
});

export const InterventionFlaggedPayloadSchema = z.object({
  skillId: z.string(),
  skillCode: z.string().optional(),
  reason: z.string(),
});

export const QuestionAnsweredPayloadSchema = z.object({
  itemId: z.string(),
  skillId: z.string(),
  subjectId: z.string(),
  correct: z.boolean(),
  mode: z.enum(['DIAGNOSTIC', 'PRACTICE', 'REVIEW']).optional(),
});

export const RouteCompletedPayloadSchema = z.object({
  skillId: z.string(),
  subjectId: z.string(),
  routeType: z.enum(['A', 'B', 'C']).optional(),
  totalItems: z.number().int().positive(),
  correctCount: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(1),
});

export const SkillStatusChangedPayloadSchema = z.object({
  skillId: z.string(),
  skillCode: z.string().optional(),
  strand: z.string().optional(),
  from: z.enum(['NOT_YET', 'DEVELOPING', 'SECURE']),
  to: z.enum(['NOT_YET', 'DEVELOPING', 'SECURE']),
});

export const RewardGrantedPayloadSchema = z.object({
  rewardEvent: z.string(),
  xp: z.number(),
  tokens: z.number(),
  reason: z.string(),
});

export const StreakExtendedPayloadSchema = z.object({
  streakDays: z.number().int().positive(),
  date: z.string(),
});

export const ShadowPairResultPayloadSchema = z.object({
  skillId: z.string(),
  subjectId: z.string(),
  routeType: z.enum(['A', 'B', 'C']).optional(),
  pairSize: z.number().int().positive(),
  correctCount: z.number().int().nonnegative(),
});

export const ExplanationRouteAssignedPayloadSchema = z.object({
  skillId: z.string(),
  skillCode: z.string().optional(),
  routeType: z.enum(['A', 'B', 'C']),
  reason: z.string(),
  source: z.enum(['diagnostic_signals', 'fallback_chain', 'history_default']),
  interventionRecommended: z.boolean().optional(),
});

export const StepCheckpointAttemptedPayloadSchema = z.object({
  routeType: z.enum(['A', 'B', 'C']),
  stepIndex: z.number().int().nonnegative(),
  stepTitle: z.string(),
  correct: z.boolean(),
  retryCount: z.number().int().nonnegative(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
});

export const StepCheckpointMasteredPayloadSchema = z.object({
  routeType: z.enum(['A', 'B', 'C']),
  stepIndex: z.number().int().nonnegative(),
  stepTitle: z.string(),
  retryCount: z.number().int().nonnegative(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
});

export const StepAlternativeShownPayloadSchema = z.object({
  routeType: z.enum(['A', 'B', 'C']),
  stepIndex: z.number().int().nonnegative(),
  stepTitle: z.string(),
  retryCount: z.number().int().nonnegative(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
});

export const EventPayloadSchemas: Record<string, z.ZodSchema> = {
  attempt_submitted: AttemptSubmittedPayloadSchema,
  attempt_graded: AttemptGradedPayloadSchema,
  question_answered: QuestionAnsweredPayloadSchema,
  route_completed: RouteCompletedPayloadSchema,
  skill_state_updated: SkillStateUpdatedPayloadSchema,
  skill_status_changed: SkillStatusChangedPayloadSchema,
  review_scheduled: ReviewScheduledPayloadSchema,
  review_completed: ReviewCompletedPayloadSchema,
  reward_granted: RewardGrantedPayloadSchema,
  streak_extended: StreakExtendedPayloadSchema,
  shadow_pair_passed: ShadowPairResultPayloadSchema,
  shadow_pair_failed: ShadowPairResultPayloadSchema,
  explanation_route_assigned: ExplanationRouteAssignedPayloadSchema,
  step_checkpoint_attempted: StepCheckpointAttemptedPayloadSchema,
  step_checkpoint_mastered: StepCheckpointMasteredPayloadSchema,
  step_alternative_shown: StepAlternativeShownPayloadSchema,
  diagnostic_completed: DiagnosticCompletedPayloadSchema,
  intervention_recommended: InterventionRecommendedPayloadSchema,
  intervention_flagged: InterventionFlaggedPayloadSchema,
};

export type EventName = keyof typeof EventPayloadSchemas;
