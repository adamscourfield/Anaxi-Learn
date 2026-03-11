import { mapRange } from '@/lib/maths/visuals/layout';
import type { NumberLineVisual } from '@/lib/maths/visuals/types';

export function NumberLineRenderer({ visual }: { visual: NumberLineVisual }) {
  const width = 320;
  const height = 92;
  const padding = 28;
  const range = visual.max - visual.min;
  const step = visual.step && visual.step > 0 ? visual.step : Math.max(1, Math.round(range / 8));
  const ticks = Array.from(
    { length: Math.floor((visual.max - visual.min) / step) + 1 },
    (_, index) => visual.min + index * step
  );

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-lg">
      <line x1={padding} y1="48" x2={width - padding} y2="48" stroke="#0f172a" strokeWidth="3" />
      {ticks.map((tick) => {
        const x = mapRange(tick, visual.min, visual.max, padding, width - padding);
        return (
          <g key={tick}>
            <line x1={x} y1="38" x2={x} y2="58" stroke="#0f172a" strokeWidth="2" />
            <text x={x} y="76" textAnchor="middle" className="fill-slate-700 text-[11px]">
              {tick}
            </text>
          </g>
        );
      })}
      {visual.markers.map((marker, index) => {
        const x = mapRange(marker.value, visual.min, visual.max, padding, width - padding);
        return (
          <g key={`${marker.value}-${index}`}>
            <circle cx={x} cy="30" r="5" fill={marker.kind === 'open' ? '#ffffff' : '#0f766e'} stroke="#0f766e" strokeWidth="2" />
            <text x={x} y="20" textAnchor="middle" className="fill-slate-700 text-xs font-medium">
              {marker.label ?? marker.value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
