import { MathsVisualRenderer } from '@/components/maths/MathsVisualRenderer';
import { resolveItemVisuals } from '@/features/learn/itemVisuals';

interface Props {
  item: {
    question: string;
    options?: unknown;
  };
  primarySkillCode?: string;
}

export function ItemVisualPanel({ item, primarySkillCode }: Props) {
  const visuals = resolveItemVisuals(item, primarySkillCode);
  if (visuals.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Maths model</h3>
        <p className="text-xs text-gray-500">This visual is rendered from structured question data, not a slide image.</p>
      </div>
      <div className="grid gap-4">
        {visuals.map((visual, index) => (
          <figure key={`${visual.type}-${index}`} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="bg-slate-50 p-4">
              <MathsVisualRenderer visual={visual} />
            </div>
            <figcaption className="border-t border-gray-100 px-4 py-3 text-xs text-gray-600">
              {visual.caption ?? visual.altText}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
