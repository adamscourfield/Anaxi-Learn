import type { AngleVisual } from '@/lib/maths/visuals/types';

export function AngleRenderer({ visual }: { visual: AngleVisual }) {
  return (
    <svg viewBox="0 0 220 180" className="w-full max-w-sm">
      <line x1={visual.vertex.x} y1={visual.vertex.y} x2={visual.arms[0].x} y2={visual.arms[0].y} stroke="#1f2937" strokeWidth="3" />
      <line x1={visual.vertex.x} y1={visual.vertex.y} x2={visual.arms[1].x} y2={visual.arms[1].y} stroke="#1f2937" strokeWidth="3" />
      {visual.label ? (
        <text x={visual.vertex.x + 12} y={visual.vertex.y - 8} className="fill-slate-700 text-sm">
          {visual.label}
        </text>
      ) : null}
    </svg>
  );
}
