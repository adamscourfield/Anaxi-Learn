/** @vitest-environment jsdom */

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LearnSession } from '@/features/learn/LearnSession';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

const baseProps = {
  subject: { id: 'sub-1', title: 'Maths', slug: 'maths' },
  skill: { id: 'skill-1', code: 'N1.1', name: 'Place value', strand: 'PV', intro: null, description: null },
  userId: 'user-1',
  gamification: { xp: 10, tokens: 0, streakDays: 1, activeDaysThisWeek: 1 },
  routeType: 'A' as const,
  reteachPlan: { routeType: 'A' as const, steps: [] },
};

describe('LearnSession clear next-step UX', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ correct: true }),
      })
    );
  });

  it('shows clear CTAs in intro, session, and results states', async () => {
    render(
      <LearnSession
        {...baseProps}
        items={[
          {
            id: 'item-1',
            question: 'What is 2 + 2?',
            options: ['3', '4'],
            answer: '4',
            type: 'MCQ',
          },
        ]}
      />
    );

    // Intro always offers a clear next step.
    expect(screen.getByRole('button', { name: /start next skill/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /start next skill/i }));

    // Session step is explicit.
    const finish = screen.getByRole('button', { name: /finish for now/i });
    expect(finish).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: '4' }));
    expect(finish).toHaveProperty('disabled', false);

    fireEvent.click(finish);

    await waitFor(() => {
      expect(screen.getByText(/session complete/i)).toBeTruthy();
    });

    // Results always provide clear next actions.
    expect(screen.getByRole('button', { name: /try this skill again/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /dashboard/i })).toBeTruthy();
  });
});
