import { describe, expect, it } from 'vitest';
import { hasPositiveTransferSignalForAttempts } from '@/features/diagnostic/routeAssignment';

describe('route assignment transfer signal', () => {
  it('is true when a correct transfer-role item exists', () => {
    const result = hasPositiveTransferSignalForAttempts([
      {
        correct: true,
        itemOptions: {
          meta: {
            question_role: 'transfer',
            transfer_level: 'medium',
            strictness_level: 'exact',
          },
        },
      },
    ]);

    expect(result).toBe(true);
  });

  it('is false when transfer-role item is incorrect', () => {
    const result = hasPositiveTransferSignalForAttempts([
      {
        correct: false,
        itemOptions: {
          meta: {
            question_role: 'transfer',
            transfer_level: 'medium',
          },
        },
      },
    ]);

    expect(result).toBe(false);
  });

  it('is false when no transfer-role item exists', () => {
    const result = hasPositiveTransferSignalForAttempts([
      {
        correct: true,
        itemOptions: {
          meta: {
            question_role: 'misconception_probe',
            transfer_level: 'none',
          },
        },
      },
    ]);

    expect(result).toBe(false);
  });
});
