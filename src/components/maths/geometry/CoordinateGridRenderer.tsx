import { mapRange } from '@/lib/maths/visuals/layout';
import type { CoordinateGridVisual } from '@/lib/maths/visuals/types';

export function CoordinateGridRenderer({ visual }: { visual: CoordinateGridVisual }) {
  const width = 260;
  const height = 220;
  const padding = 30;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-md">
      {Array.from({ length: visual.xMax - visual.xMin + 1 }, (_, index) => visual.xMin + index).map((value) => {
        const x = mapRange(value, visual.xMin, visual.xMax, padding, width - padding);
        return <line key={`x-${value}`} x1={x} y1={padding} x2={x} y2={height - padding} stroke="#e2e8f0" />;
      })}
      {Array.from({ length: visual.yMax - visual.yMin + 1 }, (_, index) => visual.yMin + index).map((value) => {
        const y = mapRange(value, visual.yMin, visual.yMax, height - padding, padding);
        return <line key={`y-${value}`} x1={padding} y1={y} x2={width - padding} y2={y} stroke="#e2e8f0" />;
      })}
      <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#0f172a" strokeWidth="2" />
      <line x1={width / 2} y1={padding} x2={width / 2} y2={height - padding} stroke="#0f172a" strokeWidth="2" />
      {visual.points?.map((point, index) => {
        const cx = mapRange(point.x, visual.xMin, visual.xMax, padding, width - padding);
        const cy = mapRange(point.y, visual.yMin, visual.yMax, height - padding, padding);
        return (
          <g key={`${point.x}-${point.y}-${index}`}>
            <circle cx={cx} cy={cy} r="4" fill="#0f766e" />
            {point.label ? (
              <text x={cx + 8} y={cy - 8} className="fill-slate-700 text-xs">
                {point.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
