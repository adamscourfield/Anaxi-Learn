import type { FractionBarVisual } from '@/lib/maths/visuals/types';

export function FractionBarRenderer({ visual }: { visual: FractionBarVisual }) {
  return (
    <div className="space-y-4">
      {visual.bars.map((bar) => {
        const total = bar.segments.reduce((sum, segment) => sum + segment.size, 0);
        let offset = 0;
        return (
          <div key={bar.id} className="space-y-2">
            {bar.label ? <p className="text-sm font-medium text-slate-700">{bar.label}</p> : null}
            <svg viewBox="0 0 300 56" className="w-full max-w-md">
              {bar.segments.map((segment, index) => {
                const width = (segment.size / total) * 280;
                const currentOffset = offset;
                offset += width;
                return (
                  <g key={`${bar.id}-${index}`}>
                    <rect
                      x={10 + currentOffset}
                      y="12"
                      width={width}
                      height="28"
                      fill={segment.shaded ? '#0f766e' : '#ffffff'}
                      stroke="#0f172a"
                      strokeWidth="2"
                    />
                    {segment.label ? (
                      <text
                        x={10 + currentOffset + width / 2}
                        y="31"
                        textAnchor="middle"
                        className={segment.shaded ? 'fill-white text-xs' : 'fill-slate-700 text-xs'}
                      >
                        {segment.label}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
          </div>
        );
      })}
    </div>
  );
}
