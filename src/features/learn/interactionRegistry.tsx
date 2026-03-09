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
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <p className="mb-2 font-semibold">Tap a place-value column</p>
        <p className="mb-2 text-[11px] text-slate-500">Select the column you want to focus on before answering checkpoint.</p>
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
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <p className="font-semibold">Tap the first different column</p>
        <p className="mt-1 text-[11px] text-slate-500">Compare from left to right and stop at first difference.</p>
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
                      className={`inline-flex h-7 w-7 items-center justify-center rounded text-sm font-semibold ${active ? (picked === firstDiff ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800') : 'bg-slate-100 text-slate-700'}`}
                    >
                      {x}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-600">
          {picked == null
            ? 'Tap a column to choose where the numbers first change.'
            : picked === firstDiff
              ? `Great pick: ${labels[picked] ?? 'that'} is right.`
              : 'Not quite yet. Check from left to right and try again.'}
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
    const selectedParts = state.decompositionParts;

    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
        <p className="font-semibold">Build the decomposition</p>
        <p className="mt-1">{formatted} = ?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {parts.map((p) => {
            const on = selectedParts.includes(p);
            return (
              <button
                key={p}
                onClick={() => {
                  const next = on ? selectedParts.filter((x) => x !== p) : [...selectedParts, p];
                  markInteraction({ decompositionParts: next, completedAt: Date.now() });
                }}
                className={`rounded-md border px-2 py-1 text-xs ${on ? 'border-blue-300 bg-blue-100 text-blue-900' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                {p}
              </button>
            );
          })}
        </div>
        <p className="mt-2 rounded bg-white px-2 py-1 text-[11px] text-slate-600">
          {selectedParts.length > 0 ? selectedParts.join(' + ') : 'Tap parts to build the expression'}
        </p>
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
