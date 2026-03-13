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
        <h3 className="text-sm font-semibold" style={{ color: 'var(--anx-text)' }}>Maths model</h3>
        <p className="text-xs" style={{ color: 'var(--anx-text-muted)' }}>This visual is rendered from structured question data, not a slide image.</p>
      </div>
      <div className="grid gap-4">
        {visuals.map((visual, index) => (
          <figure key={`${visual.type}-${index}`} className="overflow-hidden rounded-2xl border shadow-sm" style={{ borderColor: 'var(--anx-border)' }}>
            <div className="p-4" style={{ background: 'var(--anx-surface-soft)' }}>
              <MathsVisualRenderer visual={visual} />
            </div>
            <figcaption className="border-t px-4 py-3 text-xs" style={{ borderColor: 'var(--anx-border-subtle)', color: 'var(--anx-text-muted)' }}>
              {visual.caption ?? visual.altText}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
