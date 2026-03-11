import { resolveItemVisuals, type ItemVisual, type ShapeDiagramSpec } from '@/features/learn/itemVisuals';

interface Props {
  item: {
    question: string;
    options?: unknown;
  };
  primarySkillCode?: string;
}

function label(text: string, x: number, y: number, anchor: 'start' | 'middle' | 'end' = 'middle') {
  return (
    <text x={x} y={y} textAnchor={anchor} className="fill-slate-700 text-[12px] font-medium">
      {text}
    </text>
  );
}

function renderShapeDiagram(diagram: ShapeDiagramSpec) {
  switch (diagram.type) {
    case 'rectangle':
      return (
        <svg viewBox="0 0 220 160" className="h-52 w-full">
          <rect x="40" y="35" width="140" height="90" rx="10" fill="#fff7ed" stroke="#ea580c" strokeWidth="3" />
          {label(diagram.labels[0] ?? '', 110, 28)}
          {label(diagram.labels[0] ?? '', 110, 142)}
          {label(diagram.labels[1] ?? '', 28, 84, 'end')}
          {label(diagram.labels[1] ?? '', 192, 84, 'start')}
        </svg>
      );
    case 'parallelogram':
      return (
        <svg viewBox="0 0 240 170" className="h-52 w-full">
          <polygon points="60,35 180,35 155,125 35,125" fill="#eff6ff" stroke="#2563eb" strokeWidth="3" />
          {label(diagram.labels[0] ?? '', 120, 28)}
          {label(diagram.labels[0] ?? '', 95, 142)}
          {label(diagram.labels[1] ?? '', 34, 84, 'end')}
          {label(diagram.labels[1] ?? '', 202, 84, 'start')}
        </svg>
      );
    case 'isosceles-triangle':
      return (
        <svg viewBox="0 0 220 170" className="h-52 w-full">
          <polygon points="110,25 35,130 185,130" fill="#fef3c7" stroke="#ca8a04" strokeWidth="3" />
          {label(diagram.labels[0] ?? '', 63, 78)}
          {label(diagram.labels[0] ?? '', 157, 78)}
          {label(diagram.labels[1] ?? '', 110, 148)}
        </svg>
      );
    case 'isosceles-trapezium':
      return (
        <svg viewBox="0 0 240 170" className="h-52 w-full">
          <polygon points="80,35 160,35 205,130 35,130" fill="#f3e8ff" stroke="#7c3aed" strokeWidth="3" />
          {label(diagram.labels[0] ?? '', 120, 28)}
          {label(diagram.labels[1] ?? '', 120, 148)}
          {label(diagram.labels[2] ?? '', 48, 86, 'end')}
          {label(diagram.labels[2] ?? '', 192, 86, 'start')}
        </svg>
      );
    case 'regular-polygon': {
      const sides = diagram.polygonSides ?? 5;
      const points = Array.from({ length: sides }, (_, index) => {
        const angle = (-Math.PI / 2) + (index * (2 * Math.PI)) / sides;
        const x = 110 + Math.cos(angle) * 70;
        const y = 85 + Math.sin(angle) * 70;
        return `${x},${y}`;
      }).join(' ');
      return (
        <svg viewBox="0 0 220 170" className="h-52 w-full">
          <polygon points={points} fill="#ecfccb" stroke="#65a30d" strokeWidth="3" />
          {label(diagram.labels[0] ?? '', 110, 20)}
        </svg>
      );
    }
    case 'irregular-polygon':
      return (
        <svg viewBox="0 0 240 180" className="h-56 w-full">
          <polygon points="45,45 120,25 200,65 175,145 70,155 30,95" fill="#fef2f2" stroke="#dc2626" strokeWidth="3" />
          {label(diagram.labels[0] ?? '', 82, 28)}
          {label(diagram.labels[1] ?? '', 168, 44)}
          {label(diagram.labels[2] ?? '', 200, 112, 'start')}
          {label(diagram.labels[3] ?? '', 122, 168)}
          {label(diagram.labels[4] ?? '', 42, 142, 'end')}
          {label(diagram.labels[5] ?? '', 20, 86, 'end')}
        </svg>
      );
    case 'compound-l-shape':
      return (
        <svg viewBox="0 0 260 190" className="h-56 w-full">
          <path d="M45 35 H185 V85 H135 V145 H45 Z" fill="#ecfeff" stroke="#0891b2" strokeWidth="3" />
          {label(diagram.labels[0] ?? '', 115, 28)}
          {label(diagram.labels[1] ?? '', 198, 64, 'start')}
          {label(diagram.labels[2] ?? '', 160, 100)}
          {label(diagram.labels[3] ?? '', 142, 158)}
          {label(diagram.labels[4] ?? '', 32, 106, 'end')}
          {label(diagram.labels[5] ?? '', 78, 158)}
        </svg>
      );
    case 'polygon-generic':
    default:
      return (
        <svg viewBox="0 0 220 170" className="h-52 w-full">
          <polygon points="55,35 165,35 190,85 135,135 65,135 30,90" fill="#f8fafc" stroke="#475569" strokeWidth="3" />
          {label(diagram.labels[0] ?? '', 110, 28)}
          {label(diagram.labels[1] ?? '', 110, 152)}
        </svg>
      );
  }
}

function renderVisual(visual: ItemVisual, index: number) {
  if (visual.kind === 'image') {
    return (
      <figure key={`${visual.src}-${index}`} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <img src={visual.src} alt={visual.alt} className="w-full object-contain" />
        {visual.caption && <figcaption className="border-t border-gray-100 px-4 py-3 text-xs text-gray-600">{visual.caption}</figcaption>}
      </figure>
    );
  }

  return (
    <figure key={`${visual.alt}-${index}`} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="bg-slate-50 p-4">{renderShapeDiagram(visual.diagram)}</div>
      <figcaption className="border-t border-gray-100 px-4 py-3 text-xs text-gray-600">
        {visual.caption ?? visual.alt}
      </figcaption>
    </figure>
  );
}

export function ItemVisualPanel({ item, primarySkillCode }: Props) {
  const visuals = resolveItemVisuals(item, primarySkillCode);
  if (visuals.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Diagram</h3>
        <p className="text-xs text-gray-500">This question includes supporting shape visuals for the student.</p>
      </div>
      <div className="grid gap-4">{visuals.map((visual, index) => renderVisual(visual, index))}</div>
    </section>
  );
}
