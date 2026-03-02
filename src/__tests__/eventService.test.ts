import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('@/db/prisma', () => ({
  prisma: {
    event: {
      create: vi.fn().mockResolvedValue({ id: 'event-1' }),
    },
  },
}));

import { emitEvent } from '@/features/telemetry/eventService';
import { prisma } from '@/db/prisma';

describe('emitEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an event in the database', async () => {
    await emitEvent({
      name: 'attempt_submitted',
      actorUserId: 'user-1',
      studentUserId: 'user-1',
      subjectId: 'subject-1',
      skillId: 'skill-1',
      itemId: 'item-1',
      payload: {
        itemId: 'item-1',
        answer: 'Paris',
        skillId: 'skill-1',
        subjectId: 'subject-1',
      },
    });

    expect(prisma.event.create).toHaveBeenCalledOnce();
  });

  it('validates payload against schema', async () => {
    await expect(
      emitEvent({
        name: 'attempt_submitted',
        payload: { invalid: 'payload' },
      })
    ).rejects.toThrow();
  });

  it('stores events with correct fields', async () => {
    await emitEvent({
      name: 'review_scheduled',
      skillId: 'skill-1',
      payload: {
        skillId: 'skill-1',
        nextReviewAt: new Date().toISOString(),
      },
    });

    expect(prisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'review_scheduled',
          skillId: 'skill-1',
        }),
      })
    );
  });
});
