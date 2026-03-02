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

export const EventPayloadSchemas: Record<string, z.ZodSchema> = {
  attempt_submitted: AttemptSubmittedPayloadSchema,
  attempt_graded: AttemptGradedPayloadSchema,
  skill_state_updated: SkillStateUpdatedPayloadSchema,
  review_scheduled: ReviewScheduledPayloadSchema,
  review_completed: ReviewCompletedPayloadSchema,
};

export type EventName = keyof typeof EventPayloadSchemas;
