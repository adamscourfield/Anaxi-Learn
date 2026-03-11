import { describe, expect, it } from 'vitest';
import { validateMathsVisual } from '@/lib/maths/visuals/guards';
import { resolveItemVisuals } from '@/features/learn/itemVisuals';

describe('resolveItemVisuals', () => {
  it('prefers explicit structured visuals from item options when present', () => {
    const visuals = resolveItemVisuals(
      {
        question: 'Find the perimeter of this shape.',
        options: {
          visuals: [
            {
              type: 'shape',
              shape: 'rectangle',
              altText: 'Rectangle',
              vertices: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
                { x: 0, y: 10 },
              ],
            },
          ],
        },
      },
      'N2.11'
    );

    expect(visuals).toHaveLength(1);
    expect(visuals[0]).toMatchObject({
      type: 'shape',
      shape: 'rectangle',
      altText: 'Rectangle',
    });
  });

  it('builds a rectangle visual when a rectangle question has no stored spec', () => {
    const visuals = resolveItemVisuals(
      {
        question: 'Find the perimeter of a rectangle with length 9 cm and width 4 cm.',
        options: {},
      },
      'N2.11'
    );

    expect(visuals).toHaveLength(1);
    expect(visuals[0]).toMatchObject({
      type: 'shape',
      shape: 'rectangle',
    });
    expect(validateMathsVisual(visuals[0])).toEqual([]);
  });

  it('builds a number line visual for number-line skills', () => {
    const visuals = resolveItemVisuals(
      {
        question: 'Place -4, -1, 2 and 5 on the number line.',
        options: {},
      },
      'N1.13'
    );

    expect(visuals).toHaveLength(1);
    expect(visuals[0]).toMatchObject({
      type: 'number-line',
      min: -6,
      max: 7,
    });
  });

  it('builds a column arithmetic visual for formal methods questions', () => {
    const visuals = resolveItemVisuals(
      {
        question: 'Calculate 0.53 + 5.27 using column addition.',
        options: {},
      },
      'N2.5'
    );

    expect(visuals).toHaveLength(1);
    expect(visuals[0]).toMatchObject({
      type: 'arithmetic-layout',
      layout: 'column-addition',
      align: 'decimal',
    });
  });

  it('builds a compound-shape spec for compound perimeter items', () => {
    const visuals = resolveItemVisuals(
      {
        question:
          'A compound shape is made by joining two rectangles. The outside side lengths are 6 cm, 4 cm, 2 cm, 3 cm, 8 cm and 7 cm. What is its perimeter?',
        options: {},
      },
      'N2.13'
    );

    expect(visuals).toHaveLength(1);
    expect(visuals[0]).toMatchObject({
      type: 'shape',
      shape: 'compound-l-shape',
    });
  });
});
