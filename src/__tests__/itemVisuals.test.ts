import { describe, expect, it } from 'vitest';
import { resolveItemVisuals } from '@/features/learn/itemVisuals';

describe('resolveItemVisuals', () => {
  it('prefers extracted media from item options when present', () => {
    const visuals = resolveItemVisuals(
      {
        question: 'Find the perimeter of this shape.',
        options: {
          media: [{ src: '/curriculum-slide-media/test/slide-1/image.png', alt: 'Shape diagram' }],
        },
      },
      'N2.11'
    );

    expect(visuals).toEqual([
      {
        kind: 'image',
        src: '/curriculum-slide-media/test/slide-1/image.png',
        alt: 'Shape diagram',
      },
    ]);
  });

  it('builds a rectangle diagram when a rectangle question has no extracted media', () => {
    const visuals = resolveItemVisuals(
      {
        question: 'Find the perimeter of a rectangle with length 9 cm and width 4 cm.',
        options: {},
      },
      'N2.11'
    );

    expect(visuals).toHaveLength(1);
    expect(visuals[0]).toMatchObject({
      kind: 'generated',
      diagram: {
        type: 'rectangle',
        labels: ['9 cm', '4 cm'],
      },
    });
  });

  it('builds a compound-shape fallback for compound perimeter items', () => {
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
      kind: 'generated',
      diagram: {
        type: 'compound-l-shape',
      },
    });
  });
});
