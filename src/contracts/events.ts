import { z } from 'zod';

export const AttemptSubmittedPayloadSchema = z.object({
  itemId: z.string(),
  answer: z.string(),
  skillId: z.string(),
  skillCode: z.string().optional(),
  strand: z.string().optional(),
  subjectId: z.string(),
});

export const AttemptGradedPayloadSchema = z.object({
  itemId: z.string(),
  attemptId: z.string(),
  correct: z.boolean(),
  skillId: z.string(),
  skillCode: z.string().optional(),
  strand: z.string().optional(),
  subjectId: z.string(),
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
  diagnostic_completed: DiagnosticCompletedPayloadSchema,
  intervention_recommended: InterventionRecommendedPayloadSchema,
};

export type EventName = keyof typeof EventPayloadSchemas;
