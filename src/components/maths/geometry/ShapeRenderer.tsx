import { labelOffset } from '@/lib/maths/visuals/labels';
import { midpoint, paddedBounds } from '@/lib/maths/visuals/layout';
import { mathsVisualTheme } from '@/lib/maths/visuals/theme';
import type { ShapeVisual, VisualPoint } from '@/lib/maths/visuals/types';

function pointsToString(points: VisualPoint[]) {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

export function ShapeRenderer({ visual }: { visual: ShapeVisual }) {
  const bounds = paddedBounds(visual.vertices, 26);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  return (
    <svg viewBox={`${bounds.minX} ${bounds.minY} ${width} ${height}`} className="w-full max-w-md">
      <polygon
        points={pointsToString(visual.vertices)}
        fill={mathsVisualTheme.fill}
        stroke={mathsVisualTheme.stroke}
        strokeWidth={mathsVisualTheme.strokeWidth}
      />
      {visual.helperLines?.map((line, index) => (
        <g key={`helper-${index}`}>
          <line
            x1={line.from.x}
            y1={line.from.y}
            x2={line.to.x}
            y2={line.to.y}
            stroke={mathsVisualTheme.muted}
            strokeWidth="2"
            strokeDasharray={line.style === 'dashed' ? '6 5' : undefined}
          />
          {line.label ? (
            <text
              x={(line.from.x + line.to.x) / 2 + 6}
              y={(line.from.y + line.to.y) / 2 - 6}
              fontSize={mathsVisualTheme.labelSize}
              fill={mathsVisualTheme.muted}
            >
              {line.label}
            </text>
          ) : null}
        </g>
      ))}
      {visual.edges?.map((edge, index) => {
        const from = visual.vertices[edge.from];
        const to = visual.vertices[edge.to];
        const base = midpoint(from, to);
        const point = labelOffset(base, edge.offsetX ?? 0, edge.offsetY ?? 0);
        return (
          <text
            key={`edge-${index}`}
            x={point.x}
            y={point.y}
            textAnchor={edge.anchor ?? 'middle'}
            fontSize={mathsVisualTheme.labelSize}
            fill={mathsVisualTheme.stroke}
          >
            {edge.label}
          </text>
        );
      })}
      {visual.meta?.notToScale ? (
        <text x={bounds.minX + 6} y={bounds.maxY - 6} fontSize={mathsVisualTheme.captionSize} fill={mathsVisualTheme.muted}>
          Not to scale
        </text>
      ) : null}
    </svg>
  );
}
