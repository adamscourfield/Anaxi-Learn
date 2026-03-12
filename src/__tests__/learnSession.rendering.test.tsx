/** @vitest-environment jsdom */

import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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

describe('LearnSession rendering', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders MCQ options and allows selecting an option', () => {
    render(
      <LearnSession
        {...baseProps}
        items={[
          {
            id: 'item-1',
            question: 'What is 10 + 2?',
            options: ['11', '12', '13'],
            answer: '12',
            type: 'MCQ',
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /start next skill/i }));

    expect(screen.getByRole('button', { name: '11' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '12' })).toBeTruthy();

    const submit = screen.getByRole('button', { name: /finish for now/i });
    expect(submit).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: '12' }));
    expect(submit).toHaveProperty('disabled', false);
  });

  it('fails gracefully for malformed MCQ options', () => {
    render(
      <LearnSession
        {...baseProps}
        items={[
          {
            id: 'item-2',
            question: 'Pick one',
            options: { broken: true },
            answer: 'A',
            type: 'MCQ',
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /start next skill/i }));

    expect(screen.getByText(/this question has no options yet/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /finish for now/i })).toHaveProperty('disabled', true);
  });
});
