import type {
  ArithmeticLayoutVisual,
  ChartVisual,
  CoordinateGridVisual,
  FractionBarVisual,
  MathsVisual,
  NumberLineVisual,
  ShapeVisual,
} from './types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateArithmetic(visual: ArithmeticLayoutVisual): string[] {
  const issues: string[] = [];
  if (!hasText(visual.altText)) issues.push('missing alt text');
  if (visual.layout === 'place-value-table') {
    if (!Array.isArray(visual.columnHeaders) || visual.columnHeaders.length === 0) {
      issues.push('place-value-table requires column headers');
    }
    if (!Array.isArray(visual.rows) || visual.rows.length === 0) {
      issues.push('place-value-table requires rows');
    }
  } else if (!Array.isArray(visual.operands) || visual.operands.length < 1) {
    issues.push('arithmetic layout requires operands');
  }
  return issues;
}

function validateShape(visual: ShapeVisual): string[] {
  const issues: string[] = [];
  if (!hasText(visual.altText)) issues.push('missing alt text');
  if (!Array.isArray(visual.vertices) || visual.vertices.length < 3) {
    issues.push('shape visual requires at least three vertices');
  }
  return issues;
}

function validateNumberLine(visual: NumberLineVisual): string[] {
  const issues: string[] = [];
  if (!hasText(visual.altText)) issues.push('missing alt text');
  if (!(visual.min < visual.max)) issues.push('number line min must be less than max');
  if (!Array.isArray(visual.markers)) issues.push('number line requires markers');
  return issues;
}

function validateFractionBar(visual: FractionBarVisual): string[] {
  const issues: string[] = [];
  if (!hasText(visual.altText)) issues.push('missing alt text');
  if (!Array.isArray(visual.bars) || visual.bars.length === 0) {
    issues.push('fraction bar requires at least one bar');
  }
  if (visual.bars.some((bar) => !Array.isArray(bar.segments) || bar.segments.some((segment) => segment.size <= 0))) {
    issues.push('fraction bar segment sizes must be positive');
  }
  return issues;
}

function validateCoordinateGrid(visual: CoordinateGridVisual): string[] {
  const issues: string[] = [];
  if (!hasText(visual.altText)) issues.push('missing alt text');
  if (!(visual.xMin < visual.xMax) || !(visual.yMin < visual.yMax)) {
    issues.push('coordinate grid ranges must increase');
  }
  return issues;
}

function validateChart(visual: ChartVisual): string[] {
  const issues: string[] = [];
  if (!hasText(visual.altText)) issues.push('missing alt text');
  if (!Array.isArray(visual.series) || visual.series.length === 0) {
    issues.push('chart requires at least one series value');
  }
  return issues;
}

export function validateMathsVisual(visual: MathsVisual): string[] {
  switch (visual.type) {
    case 'arithmetic-layout':
      return validateArithmetic(visual);
    case 'shape':
      return validateShape(visual);
    case 'number-line':
      return validateNumberLine(visual);
    case 'fraction-bar':
      return validateFractionBar(visual);
    case 'coordinate-grid':
      return validateCoordinateGrid(visual);
    case 'chart':
      return validateChart(visual);
    case 'angle-diagram':
      return hasText(visual.altText) ? [] : ['missing alt text'];
    default:
      return ['unknown visual type'];
  }
}

export function isMathsVisual(value: unknown): value is MathsVisual {
  if (!isObject(value) || !hasText(value.type) || !hasText(value.altText)) return false;
  return validateMathsVisual(value as unknown as MathsVisual).length === 0;
}
