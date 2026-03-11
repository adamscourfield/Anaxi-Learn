import type { ChartVisual } from '@/lib/maths/visuals/types';

export function ChartRenderer({ visual }: { visual: ChartVisual }) {
  const maxValue = Math.max(...visual.series.map((entry) => entry.value), 1);
  return (
    <svg viewBox="0 0 320 220" className="w-full max-w-md">
      <line x1="30" y1="190" x2="295" y2="190" stroke="#0f172a" strokeWidth="2" />
      <line x1="30" y1="20" x2="30" y2="190" stroke="#0f172a" strokeWidth="2" />
      {visual.series.map((entry, index) => {
        const width = 38;
        const gap = 18;
        const x = 48 + index * (width + gap);
        const height = (entry.value / maxValue) * 140;
        return (
          <g key={entry.label}>
            <rect x={x} y={190 - height} width={width} height={height} fill="#0f766e" />
            <text x={x + width / 2} y="206" textAnchor="middle" className="fill-slate-700 text-[11px]">
              {entry.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
