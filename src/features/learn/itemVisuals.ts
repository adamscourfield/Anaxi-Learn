export interface ItemImageVisual {
  kind: 'image';
  src: string;
  alt: string;
  caption?: string;
}

export interface ShapeDiagramSpec {
  type:
    | 'rectangle'
    | 'parallelogram'
    | 'isosceles-triangle'
    | 'isosceles-trapezium'
    | 'regular-polygon'
    | 'irregular-polygon'
    | 'compound-l-shape'
    | 'polygon-generic';
  labels: string[];
  polygonSides?: number;
}

export interface ItemGeneratedVisual {
  kind: 'generated';
  alt: string;
  caption?: string;
  diagram: ShapeDiagramSpec;
}

export type ItemVisual = ItemImageVisual | ItemGeneratedVisual;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseMedia(options: unknown): ItemImageVisual[] {
  if (!isObject(options) || !Array.isArray(options.media)) return [];

  const visuals: ItemImageVisual[] = [];

  for (const entry of options.media) {
    if (!isObject(entry)) continue;
    const src = toString(entry.src);
    if (!src) continue;
    visuals.push({
      kind: 'image' as const,
      src,
      alt: toString(entry.alt) ?? 'Question diagram',
      caption: toString(entry.caption) ?? undefined,
    });
  }

  return visuals;
}

function parseCentimetreValues(question: string): string[] {
  return [...question.matchAll(/([-+]?\d+(?:\.\d+)?)\s*cm\b/gi)].map((match) => `${match[1]} cm`);
}

function regularPolygonSides(question: string): number | null {
  const lowered = question.toLowerCase();
  if (lowered.includes('triangle')) return 3;
  if (lowered.includes('square')) return 4;
  if (lowered.includes('pentagon')) return 5;
  if (lowered.includes('hexagon')) return 6;
  if (lowered.includes('heptagon')) return 7;
  if (lowered.includes('octagon')) return 8;
  return null;
}

function generatedShapeVisual(question: string, primarySkillCode?: string): ItemGeneratedVisual | null {
  const lowered = question.toLowerCase();
  const lengths = parseCentimetreValues(question);

  if (primarySkillCode === 'N2.13' || lowered.includes('compound shape')) {
    return {
      kind: 'generated',
      alt: 'Compound shape diagram',
      caption: 'Compound L-shaped diagram showing the outside edges only.',
      diagram: { type: 'compound-l-shape', labels: lengths.slice(0, 6) },
    };
  }

  if (lowered.includes('rectangle')) {
    const labelA = lengths[0] ?? 'length';
    const labelB = lengths[1] ?? 'width';
    return {
      kind: 'generated',
      alt: 'Rectangle diagram',
      caption: 'Rectangle diagram showing the given side lengths.',
      diagram: { type: 'rectangle', labels: [labelA, labelB] },
    };
  }

  if (lowered.includes('parallelogram')) {
    const labelA = lengths[0] ?? 'side a';
    const labelB = lengths[1] ?? 'side b';
    return {
      kind: 'generated',
      alt: 'Parallelogram diagram',
      caption: 'Parallelogram diagram showing the given side lengths.',
      diagram: { type: 'parallelogram', labels: [labelA, labelB] },
    };
  }

  if (lowered.includes('isosceles triangle')) {
    const equalSide = lengths[0] ?? 'equal side';
    const base = lengths[1] ?? 'base';
    return {
      kind: 'generated',
      alt: 'Isosceles triangle diagram',
      caption: 'Isosceles triangle with two equal sides.',
      diagram: { type: 'isosceles-triangle', labels: [equalSide, base] },
    };
  }

  if (lowered.includes('isosceles trapezium')) {
    return {
      kind: 'generated',
      alt: 'Isosceles trapezium diagram',
      caption: 'Isosceles trapezium with equal non-parallel sides.',
      diagram: {
        type: 'isosceles-trapezium',
        labels: [lengths[0] ?? 'top', lengths[1] ?? 'base', lengths[2] ?? 'equal side'],
      },
    };
  }

  if (lowered.includes('regular') && lowered.includes('polygon')) {
    return {
      kind: 'generated',
      alt: 'Regular polygon diagram',
      caption: 'Regular polygon: equal sides and equal angles.',
      diagram: {
        type: 'polygon-generic',
        labels: ['equal sides', 'equal angles'],
      },
    };
  }

  const polygonSides = regularPolygonSides(question);
  if (polygonSides) {
    return {
      kind: 'generated',
      alt: `Regular ${polygonSides}-sided polygon diagram`,
      caption: 'Regular polygon with equal side lengths.',
      diagram: {
        type: 'regular-polygon',
        labels: [lengths[0] ?? 'side length'],
        polygonSides,
      },
    };
  }

  if (primarySkillCode === 'N2.9' || lowered.includes('irregular polygon')) {
    return {
      kind: 'generated',
      alt: 'Irregular polygon diagram',
      caption: 'Irregular polygon with the side lengths placed around the outside.',
      diagram: { type: 'irregular-polygon', labels: lengths.slice(0, 6) },
    };
  }

  if (
    primarySkillCode === 'N2.10' ||
    primarySkillCode === 'N2.11' ||
    primarySkillCode === 'N2.12'
  ) {
    return {
      kind: 'generated',
      alt: 'Polygon diagram',
      caption: 'Shape diagram for this perimeter question.',
      diagram: { type: 'polygon-generic', labels: lengths.slice(0, 4) },
    };
  }

  return null;
}

export function resolveItemVisuals(
  item: {
    question: string;
    options?: unknown;
  },
  primarySkillCode?: string
): ItemVisual[] {
  const media = parseMedia(item.options);
  if (media.length > 0) {
    return media;
  }

  const generated = generatedShapeVisual(item.question, primarySkillCode);
  return generated ? [generated] : [];
}
