import { describe, expect, it } from 'vitest';
import {
  deriveStoredItemFromMapping,
  getItemContractIssues,
  inferCanonicalQuestionFormat,
} from '@/features/content/questionContract';

describe('questionContract', () => {
  it('maps true false questions to a true/false interaction', () => {
    const derived = deriveStoredItemFromMapping({
      source: { question_ref: 'Slide1-Q1' },
      question: { stem: '3 < 5', format: 'SHORT', answer: 'True' },
      skills: { primary_skill_code: 'N1.3' },
      marking: { accepted_answers: ['True'] },
    });

    expect(derived.type).toBe('TRUE_FALSE');
    expect(derived.options.choices).toEqual(['True', 'False']);
  });

  it('maps ordering questions to ordered interaction with parsed values', () => {
    const derived = deriveStoredItemFromMapping({
      source: { question_ref: 'Slide2-Q1' },
      question: {
        stem: 'Order temperatures from coldest to warmest: 8°C, 12°C, 9°C, 15°C, 11°C, 7°C, 2°C.',
        format: 'ORDER_SEQUENCE',
        answer: '2°C | 7°C | 8°C | 9°C | 11°C | 12°C | 15°C',
      },
      skills: { primary_skill_code: 'N1.15' },
      marking: { accepted_answers: ['2°C | 7°C | 8°C | 9°C | 11°C | 12°C | 15°C'] },
    });

    expect(derived.type).toBe('ORDER');
    expect(derived.options.choices).toContain('2°C');
    expect(derived.options.choices).toContain('15°C');
  });

  it('infers greater-than comparisons as single choice', () => {
    expect(inferCanonicalQuestionFormat(undefined, 'Which is greater: -3 or -8?', '-3')).toBe('SINGLE_CHOICE');
  });

  it('flags single choice items when the answer is missing from choices', () => {
    const issues = getItemContractIssues({
      question: 'Which is greater: -3 or -8?',
      type: 'MCQ',
      answer: '-3',
      options: { choices: ['-8', '-7'], acceptedAnswers: ['-3'] },
    });

    expect(issues.some((issue) => issue.code === 'mcq_missing_answer')).toBe(true);
  });

  it('flags duplicate raw choices', () => {
    const issues = getItemContractIssues({
      question: 'Pick the larger number.',
      type: 'MCQ',
      answer: '8',
      options: { choices: ['8', '8', '3'], acceptedAnswers: ['8'] },
    });

    expect(issues.some((issue) => issue.code === 'duplicate_choices')).toBe(true);
  });
});
