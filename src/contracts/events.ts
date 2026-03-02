import { z } from 'zod';

export const AttemptSubmittedPayloadSchema = z.object({
  itemId: z.string(),
  answer: z.string(),
  skillId: z.string(),
  subjectId: z.string(),
});

export const AttemptGradedPayloadSchema = z.object({
  itemId: z.string(),
  attemptId: z.string(),
  correct: z.boolean(),
  skillId: z.string(),
  subjectId: z.string(),
});

export const SkillStateUpdatedPayloadSchema = z.object({
  skillId: z.string(),
  mastery: z.number().min(0).max(1),
  lastPracticedAt: z.string(),
  nextReviewAt: z.string(),
});

export const ReviewScheduledPayloadSchema = z.object({
  skillId: z.string(),
  nextReviewAt: z.string(),
});

export const EventPayloadSchemas: Record<string, z.ZodSchema> = {
  attempt_submitted: AttemptSubmittedPayloadSchema,
  attempt_graded: AttemptGradedPayloadSchema,
  skill_state_updated: SkillStateUpdatedPayloadSchema,
  review_scheduled: ReviewScheduledPayloadSchema,
};

export type EventName = keyof typeof EventPayloadSchemas;
