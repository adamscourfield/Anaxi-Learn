import { beforeEach, describe, expect, it, vi } from 'vitest';

const emitEventMock = vi.fn();
const updateSkillMasteryMock = vi.fn();
const gradeAttemptMock = vi.fn();

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => ({ user: { id: 'user-1' } })),
}));

vi.mock('@/features/auth/authOptions', () => ({ authOptions: {} }));

vi.mock('@/db/prisma', () => ({
  prisma: {
    item: {
      findUnique: vi.fn(async () => ({ id: 'item-2', answer: '4', type: 'MCQ', question: '2+2', options: ['3', '4'] })),
    },
    skillMastery: {
      findUnique: vi.fn(async () => null),
    },
    attempt: {
      create: vi.fn(async () => ({ id: 'att-2', createdAt: new Date('2026-03-10T10:00:00.000Z') })),
      findFirst: vi.fn(async () => null),
    },
    interventionFlag: {
      upsert: vi.fn(async () => undefined),
    },
  },
}));

vi.mock('@/features/learn/gradeAttempt', () => ({
  gradeAttempt: gradeAttemptMock,
  getAnswerFormatHint: vi.fn(() => null),
}));

vi.mock('@/features/telemetry/eventService', () => ({
  emitEvent: emitEventMock,
}));

vi.mock('@/features/mastery/updateMastery', () => ({
  updateSkillMastery: updateSkillMasteryMock,
}));

vi.mock('@/features/gamification/gamificationService', () => ({
  consumeGuessingSafeguard: vi.fn(async () => ({ xpMultiplier: 1, penaltyApplied: false, penaltyRemaining: 0 })),
  grantReward: vi.fn(async () => undefined),
  maybeGrantDailyStreak: vi.fn(async () => undefined),
}));

describe('learn attempt mastery/UI summary consistency', () => {
  beforeEach(() => {
    emitEventMock.mockClear();
    updateSkillMasteryMock.mockClear();
    gradeAttemptMock.mockReset();
  });

  it('persists mastery with correctCount/totalItems matching final session rollup', async () => {
    gradeAttemptMock.mockReturnValue(true); // current/final answer is correct
    const { POST } = await import('@/app/api/learn/attempt/route');

    const req = {
      json: async () => ({
        itemId: 'item-2',
        skillId: 'skill-1',
        subjectId: 'subject-1',
        answer: '4',
        isLast: true,
        questionIndex: 1,
        routeType: 'A',
        totalItems: 2,
        previousResults: [{ itemId: 'item-1', correct: false }],
      }),
    } as Request;

    await POST(req as never);

    expect(updateSkillMasteryMock).toHaveBeenCalledTimes(1);
    expect(updateSkillMasteryMock).toHaveBeenCalledWith(
      'user-1',
      'skill-1',
      'subject-1',
      1, // one correct out of two total
      2,
      'PRACTICE'
    );
  });
});
