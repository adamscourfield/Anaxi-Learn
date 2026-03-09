import type { ReactNode } from 'react';
import type { ReteachStep } from './reteachContent';

export interface StepInteractionState {
  startedAt?: number;
  completedAt?: number;
  placeValueSelection?: string;
  compareColumnIndex?: number;
  decompositionParts: string[];
}

export interface InteractionStatus {
  started: boolean;
  completed: boolean;
  selected?: string | string[] | number | null;
  firstDiff?: number;
}

interface RendererContext {
  step: ReteachStep;
  state: StepInteractionState;
  markInteraction: (patch: Partial<StepInteractionState>) => void;
}

interface InteractionRenderer {
  status: (ctx: RendererContext) => InteractionStatus;
  render: (ctx: RendererContext) => ReactNode;
}

function splitDigits(n: string): string[] {
  const clean = n.replace(/[^0-9]/g, '');
  return clean.split('');
}

function decomposeParts(number: string): string[] {
  const digits = splitDigits(number);
  const len = digits.length;
  const parts: string[] = [];
  digits.forEach((d, i) => {
    const digit = Number(d);
    if (digit === 0) return;
    const zeros = len - i - 1;
    parts.push(String(digit * 10 ** zeros));
  });
  return parts;
}

function decomposeOptions(number: string): string[] {
  const digits = splitDigits(number);
  const len = digits.length;
  const correct = decomposeParts(number);
  const options = new Set<string>(correct);

  // Plausible distractors: right digit, wrong place value.
  digits.forEach((d, i) => {
    const digit = Number(d);
    if (digit === 0) return;
    const zeros = Math.max(0, len - i - 2);
    const wrong = String(digit * 10 ** zeros);
    if (!correct.includes(wrong)) options.add(wrong);
  });

  // Include bare digit distractors for larger numbers.
  digits.forEach((d) => {
    if (d !== '0' && !correct.includes(d)) options.add(d);
  });

  // Keep a stable, readable order and enough choice for mistakes.
  return Array.from(options)
    .sort((a, b) => Number(b) - Number(a))
    .slice(0, Math.max(correct.length + 3, 6));
}

const noneRenderer: InteractionRenderer = {
  status: () => ({ started: false, completed: false }),
  render: () => null,
};

const placeValueRenderer: InteractionRenderer = {
  status: ({ state }) => ({
    started: Boolean(state.startedAt),
    completed: Boolean(state.placeValueSelection),
    selected: state.placeValueSelection ?? null,
  }),
  render: ({ step, state, markInteraction }) => {
    const payload = step.interaction?.config ?? step.visualPayload ?? {};
    const number = String(payload.number ?? '7460');
    const digits = splitDigits(number);
    const labels = ['Thousands', 'Hundreds', 'Tens', 'Ones'];

    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-base text-slate-700">
        <p className="mb-2 text-lg font-bold text-slate-900">🔢 Tap a place-value column</p>
        <p className="mb-2 text-sm text-slate-600">Pick the column you want to focus on before answering.</p>
        <div className="grid grid-cols-4 gap-2">
          {labels.map((h, i) => {
            const active = state.placeValueSelection === h;
            return (
              <button
                key={h}
                onClick={() => markInteraction({ placeValueSelection: h, completedAt: Date.now() })}
                className={`rounded border px-2 py-2 text-center ${active ? 'border-blue-300 bg-blue-100' : 'border-slate-200 bg-white'}`}
              >
                <p className="text-[10px] uppercase tracking-wide text-slate-500">{h}</p>
                <p className="mt-1 text-base font-bold text-slate-900">{digits[i] ?? '0'}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  },
};

const compareRenderer: InteractionRenderer = {
  status: ({ step, state }) => {
    const payload = step.interaction?.config ?? step.visualPayload ?? {};
    const left = splitDigits(String(payload.left ?? '5203'));
    const right = splitDigits(String(payload.right ?? '5123'));
    let firstDiff = -1;
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
      if ((left[i] ?? '0') !== (right[i] ?? '0')) {
        firstDiff = i;
        break;
      }
    }
    const chosen = state.compareColumnIndex;
    return {
      started: Boolean(state.startedAt),
      completed: chosen != null && chosen === firstDiff,
      selected: chosen ?? null,
      firstDiff,
    };
  },
  render: ({ step, state, markInteraction }) => {
    const payload = step.interaction?.config ?? step.visualPayload ?? {};
    const left = String(payload.left ?? '5203');
    const right = String(payload.right ?? '5123');
    const l = splitDigits(left);
    const r = splitDigits(right);
    const labels = ['Thousands', 'Hundreds', 'Tens', 'Ones'];
    let firstDiff = -1;
    for (let i = 0; i < Math.max(l.length, r.length); i++) {
      if ((l[i] ?? '0') !== (r[i] ?? '0')) {
        firstDiff = i;
        break;
      }
    }

    const picked = state.compareColumnIndex;

    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-base text-slate-700">
        <p className="font-bold text-slate-900">🧠 Tap the first different column</p>
        <p className="mt-1 text-sm text-slate-600">Compare from left to right and stop at the first difference.</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {[{ name: 'A', d: l }, { name: 'B', d: r }].map((row) => (
            <div key={row.name} className="rounded border border-slate-200 bg-white p-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-500">{row.name}</p>
              <div className="mt-1 flex gap-1">
                {row.d.map((x, i) => {
                  const active = picked === i;
                  return (
                    <button
                      key={`${row.name}-${i}`}
                      onClick={() => markInteraction({ compareColumnIndex: i, completedAt: Date.now() })}
                      className={`inline-flex h-10 w-10 items-center justify-center rounded text-base font-semibold ${active ? (picked === firstDiff ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800') : 'bg-slate-100 text-slate-700'}`}
                    >
                      {x}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-slate-700">
          {picked == null
            ? 'Tap a column to choose where the numbers first change.'
            : picked === firstDiff
              ? `Brilliant! ${labels[picked] ?? 'That'} is the correct column ✅`
              : 'Good try — scan from left to right and have another go.'}
        </p>
      </div>
    );
  },
};

const decomposeRenderer: InteractionRenderer = {
  status: ({ step, state }) => {
    const payload = step.interaction?.config ?? step.visualPayload ?? {};
    const number = String(payload.number ?? '8030406');
    const expected = decomposeParts(number);
    const chosen = state.decompositionParts;
    const completed = expected.length > 0 && expected.every((p) => chosen.includes(p)) && chosen.length === expected.length;
    return {
      started: Boolean(state.startedAt),
      completed,
      selected: chosen,
    };
  },
  render: ({ step, state, markInteraction }) => {
    const payload = step.interaction?.config ?? step.visualPayload ?? {};
    const number = String(payload.number ?? '8030406');
    const formatted = number.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const parts = decomposeParts(number);
    const options = decomposeOptions(number);
    const selectedParts = state.decompositionParts;

    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-base text-slate-700">
        <p className="text-lg font-bold text-slate-900">🧩 Build the decomposition</p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{formatted} = ?</p>
        <div className="mt-3 flex flex-wrap gap-2.5">
          {options.map((p) => {
            const on = selectedParts.includes(p);
            return (
              <button
                key={p}
                onClick={() => {
                  const next = on ? selectedParts.filter((x) => x !== p) : [...selectedParts, p];
                  markInteraction({ decompositionParts: next, completedAt: Date.now() });
                }}
                className={`rounded-lg border px-3 py-2 text-base font-semibold ${on ? 'border-blue-300 bg-blue-100 text-blue-900' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                {p}
              </button>
            );
          })}
        </div>
        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-slate-700">
          {selectedParts.length > 0 ? selectedParts.join(' + ') : 'Tap parts to build your answer'}
        </p>
        <p className="mt-2 text-sm text-slate-600">Tip: choose all correct parts only — the extra options are there to test your thinking.</p>
      </div>
    );
  },
};

const renderers: Record<string, InteractionRenderer> = {
  'place_value_select.v1': placeValueRenderer,
  'compare_columns.v1': compareRenderer,
  'decompose_number.v1': decomposeRenderer,
  place_value_grid: placeValueRenderer,
  compare_columns: compareRenderer,
  decompose_number: decomposeRenderer,
  none: noneRenderer,
};

export function getInteractionRenderer(step: ReteachStep): InteractionRenderer {
  const key = step.interaction?.type ?? step.visualType ?? 'none';
  return renderers[key] ?? noneRenderer;
}
