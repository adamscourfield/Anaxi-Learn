/** @vitest-environment jsdom */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LearnSession } from '@/features/learn/LearnSession';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const baseProps = {
  subject: { id: 'sub-1', title: 'Maths', slug: 'maths' },
  skill: { id: 'skill-1', code: 'N1.1', name: 'Place value', strand: 'PV', intro: null, description: null },
  userId: 'user-1',
  gamification: { xp: 10, tokens: 0, streakDays: 1, activeDaysThisWeek: 1 },
  routeType: 'A' as const,
  reteachPlan: { routeType: 'A' as const, steps: [] },
};

describe('LearnSession short entry rendering', () => {
  it('renders SHORT_NUMERIC input with numeric placeholder', () => {
    render(
      <LearnSession
        {...baseProps}
        items={[
          {
            id: 'item-num',
            question: 'What is 3 + 4?',
            options: {},
            answer: '7',
            type: 'SHORT_NUMERIC',
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /start next skill/i }));

    const input = screen.getByPlaceholderText(/enter a number/i);
    expect(input).toBeTruthy();

    const submit = screen.getByRole('button', { name: /^finish for now$/i });
    expect(submit).toHaveProperty('disabled', true);

    fireEvent.change(input, { target: { value: '7' } });
    expect(submit).toHaveProperty('disabled', false);
  });

  it('renders SHORT_TEXT input with text guidance', () => {
    render(
      <LearnSession
        {...baseProps}
        items={[
          {
            id: 'item-text',
            question: 'Write one hundred and five in words.',
            options: {},
            answer: 'one hundred and five',
            type: 'SHORT_TEXT',
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /start next skill/i }));

    const input = screen.getByPlaceholderText(/type your answer/i);
    expect(input).toBeTruthy();
    expect(screen.getByText(/use clear words\. commas and “and” are both okay\./i)).toBeTruthy();

    const submit = screen.getByRole('button', { name: /^finish for now$/i });
    expect(submit).toHaveProperty('disabled', true);

    fireEvent.change(input, { target: { value: 'one hundred and five' } });
    expect(submit).toHaveProperty('disabled', false);
  });

  it('renders ORDER items as fridge magnets', () => {
    render(
      <LearnSession
        {...baseProps}
        items={[
          {
            id: 'item-order',
            question: 'Order from smallest to largest: 3, 1, 2',
            options: { choices: ['3', '1', '2'] },
            answer: '1 | 2 | 3',
            type: 'ORDER',
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /start next skill/i }));

    expect(screen.getByText(/arrange the fridge magnets into the correct order/i)).toBeTruthy();

    const submit = screen.getByRole('button', { name: /^finish for now$/i });
    expect(submit).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('button', { name: /^3$/i }));
    expect(submit).toHaveProperty('disabled', false);
  });
});
