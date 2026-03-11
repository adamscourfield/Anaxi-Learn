import { ChartRenderer } from '@/components/maths/charts/ChartRenderer';
import { ArithmeticLayoutRenderer } from '@/components/maths/arithmetic/ArithmeticLayoutRenderer';
import { AngleRenderer } from '@/components/maths/geometry/AngleRenderer';
import { CoordinateGridRenderer } from '@/components/maths/geometry/CoordinateGridRenderer';
import { ShapeRenderer } from '@/components/maths/geometry/ShapeRenderer';
import { FractionBarRenderer } from '@/components/maths/number/FractionBarRenderer';
import { NumberLineRenderer } from '@/components/maths/number/NumberLineRenderer';
import { validateMathsVisual } from '@/lib/maths/visuals/guards';
import type { MathsVisual } from '@/lib/maths/visuals/types';

export function MathsVisualRenderer({ visual }: { visual: MathsVisual }) {
  const issues = validateMathsVisual(visual);
  if (issues.length > 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Visual unavailable: {issues.join(', ')}.
      </div>
    );
  }

  switch (visual.type) {
    case 'arithmetic-layout':
      return <ArithmeticLayoutRenderer visual={visual} />;
    case 'shape':
      return <ShapeRenderer visual={visual} />;
    case 'number-line':
      return <NumberLineRenderer visual={visual} />;
    case 'fraction-bar':
      return <FractionBarRenderer visual={visual} />;
    case 'angle-diagram':
      return <AngleRenderer visual={visual} />;
    case 'coordinate-grid':
      return <CoordinateGridRenderer visual={visual} />;
    case 'chart':
      return <ChartRenderer visual={visual} />;
    default:
      return null;
  }
}
