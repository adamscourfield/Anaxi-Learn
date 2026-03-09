'use client';

import { useMemo, useState } from 'react';
import type { ReteachPlan, RouteType } from './reteachContent';

interface Props {
  subjectId: string;
  skillId: string;
  routeType: RouteType;
  plan: ReteachPlan;
  onComplete: () => void;
}

interface StepInteractionState {
  startedAt?: number;
  completedAt?: number;
  placeValueSelection?: string;
  compareColumnIndex?: number;
  decompositionParts: string[];
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

export function ReteachSession({ subjectId, skillId, routeType, plan, onComplete }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [selected, setSelected] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [guided, setGuided] = useState('');
  const [retryCounts, setRetryCounts] = useState<Record<number, number>>({});
  const [altShown, setAltShown] = useState<Record<number, boolean>>({});
  const [stepStartMs, setStepStartMs] = useState<number>(Date.now());
  const [interactionByStep, setInteractionByStep] = useState<Record<number, StepInteractionState>>({});

  const step = plan.steps[stepIndex];
  const interaction = interactionByStep[stepIndex] ?? { decompositionParts: [] };

  const markInteraction = (patch: Partial<StepInteractionState>) => {
    setInteractionByStep((prev) => {
      const curr = prev[stepIndex] ?? { decompositionParts: [] };
      const startedAt = curr.startedAt ?? Date.now();
      return {
        ...prev,
        [stepIndex]: {
          ...curr,
          startedAt,
          ...patch,
        },
      };
    });
  };

  const interactionStatus = useMemo(() => {
    const payload = step.visualPayload ?? {};

    if (step.visualType === 'place_value_grid') {
      return {
        started: Boolean(interaction.startedAt),
        completed: Boolean(interaction.placeValueSelection),
        selected: interaction.placeValueSelection ?? null,
      };
    }

    if (step.visualType === 'compare_columns') {
      const left = splitDigits(String(payload.left ?? '5203'));
      const right = splitDigits(String(payload.right ?? '5123'));
      let firstDiff = -1;
      for (let i = 0; i < Math.max(left.length, right.length); i++) {
        if ((left[i] ?? '0') !== (right[i] ?? '0')) {
          firstDiff = i;
          break;
        }
      }
      const chosen = interaction.compareColumnIndex;
      return {
        started: Boolean(interaction.startedAt),
        completed: chosen != null && chosen === firstDiff,
        selected: chosen ?? null,
        firstDiff,
      };
    }

    if (step.visualType === 'decompose_number') {
      const number = String(payload.number ?? '8030406');
      const expected = decomposeParts(number);
      const chosen = interaction.decompositionParts;
      const completed = expected.length > 0 && expected.every((p) => chosen.includes(p)) && chosen.length === expected.length;
      return {
        started: Boolean(interaction.startedAt),
        completed,
        expected,
        selected: chosen,
      };
    }

    return { started: false, completed: false };
  }, [interaction, step.visualPayload, step.visualType]);

  function renderVisual() {
    const payload = step.visualPayload ?? {};

    if (step.visualType === 'place_value_grid') {
      const number = String(payload.number ?? '7460');
      const digits = splitDigits(number);
      const labels = ['Thousands', 'Hundreds', 'Tens', 'Ones'];
      return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <p className="mb-2 font-semibold">Tap a place-value column</p>
          <p className="mb-2 text-[11px] text-slate-500">Select the column you want to focus on before answering checkpoint.</p>
          <div className="grid grid-cols-4 gap-2">
            {labels.map((h, i) => {
              const active = interaction.placeValueSelection === h;
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
    }

    if (step.visualType === 'decompose_number') {
      const number = String(payload.number ?? '8030406');
      const formatted = number.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const parts = decomposeParts(number);
      const selectedParts = interaction.decompositionParts;
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
    }

    if (step.visualType === 'compare_columns') {
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

      const picked = interaction.compareColumnIndex;

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
                        className={`inline-flex h-7 w-7 items-center justify-center rounded text-sm font-semibold ${active ? 'bg-blue-100 text-blue-800' : i === firstDiff ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}
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
              ? 'Tap a column to lock your first-difference choice.'
              : picked === firstDiff
                ? `Great pick: ${labels[picked] ?? 'that'} is the first difference.`
                : `Check again: first difference is in ${labels[firstDiff] ?? 'another'} column.`}
          </p>
        </div>
      );
    }

    return null;
  }

  async function checkStep() {
    if (!selected) return;
    const correct = selected === step.checkpointAnswer;
    const newRetry = (retryCounts[stepIndex] ?? 0) + 1;
    const shouldShowAlt = !correct && newRetry >= 2;

    setRetryCounts((r) => ({ ...r, [stepIndex]: newRetry }));
    if (shouldShowAlt) {
      setAltShown((a) => ({ ...a, [stepIndex]: true }));
    }

    setFeedback(correct ? 'correct' : 'incorrect');

    const durationMs = Math.max(0, Date.now() - stepStartMs);
    const interactionDurationMs = interaction.startedAt ? Math.max(0, Date.now() - interaction.startedAt) : undefined;

    await fetch('/api/learn/reteach-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectId,
        skillId,
        routeType,
        stepIndex,
        stepTitle: step.title,
        correct,
        retryCount: newRetry,
        durationMs,
        alternativeShown: shouldShowAlt,
        interactionStarted: interactionStatus.started,
        interactionCompleted: interactionStatus.completed,
        interactionType: step.visualType ?? 'none',
        interactionDurationMs,
      }),
    });

    if (correct) {
      setTimeout(() => {
        setFeedback(null);
        setSelected('');
        if (stepIndex < plan.steps.length - 1) {
          setStepIndex((i) => i + 1);
          setStepStartMs(Date.now());
        }
      }, 420);
    }
  }

  const doneSteps = stepIndex >= plan.steps.length - 1 && feedback === 'correct';
  const normalize = (s: string) => s.toLowerCase().replace(/[,\s]+/g, ' ').trim();
  const guidedOk = normalize(guided) === normalize(plan.guidedAnswer);
  const interactionRequired = (step.visualType ?? 'none') !== 'none';
  const canCheck = Boolean(selected) && (!interactionRequired || interactionStatus.completed);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        <p className="font-semibold">Let’s fix one idea at a time</p>
        <p className="mt-1">{plan.misconceptionSummary}</p>
        <p className="mt-1 text-xs text-amber-800">No rush — each step has a quick check before we move on.</p>
      </div>

      <div className={`rounded-2xl border border-slate-200 bg-white p-5 ${feedback === 'correct' ? 'anx-pulse-correct' : ''} ${feedback === 'incorrect' ? 'anx-shake-incorrect' : ''}`}>
        <p className="text-xs uppercase tracking-wide text-slate-500">Step {stepIndex + 1} of {plan.steps.length}</p>
        <h3 className="mt-1 text-base font-semibold text-slate-900">{step.title}</h3>
        {step.stepType && <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-blue-700">{step.stepType.replace('_', ' ')}</p>}
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{step.explanation}</p>

        <div className="mt-4">{renderVisual()}</div>

        <div className="mt-2 text-[11px] text-slate-500">
          Interaction: {interactionStatus.completed ? 'completed' : interactionStatus.started ? 'started' : 'not started'}
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Checkpoint</p>
          <p className="mt-1 text-sm text-slate-700">{step.checkpointQuestion}</p>
          <div className="mt-3 space-y-2">
            {step.checkpointOptions.map((option) => (
              <button key={option} onClick={() => setSelected(option)} className={`anx-option ${selected === option ? 'anx-option-selected' : ''}`}>
                {option}
              </button>
            ))}
          </div>
          <button onClick={checkStep} className="anx-btn-primary mt-4 w-full py-3 text-sm" disabled={!canCheck}>
            Check this step
          </button>
          {!selected && <p className="mt-2 text-xs text-slate-500">Choose a checkpoint answer to continue.</p>}
          {selected && interactionRequired && !interactionStatus.completed && (
            <p className="mt-2 text-xs text-amber-700">Finish the interactive visual first, then check your step.</p>
          )}
          {feedback === 'incorrect' && <p className="mt-2 text-xs text-rose-600">Nearly there — use the hint and try that same checkpoint again.</p>}
          {feedback === 'correct' && <p className="mt-2 text-xs text-emerald-600">Nice work — that step is secure.</p>}
          {altShown[stepIndex] && (
            <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
              <p className="font-semibold">Alternative explanation</p>
              <p>{step.alternativeHint ?? 'Try naming each place-value column aloud before choosing.'}</p>
            </div>
          )}
        </div>
      </div>

      {stepIndex === plan.steps.length - 1 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Worked example</p>
          <p className="mt-1">{plan.workedExample}</p>
        </div>
      )}

      {doneSteps && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Guided model</p>
          <p className="mt-1 text-sm text-slate-700">{plan.guidedPrompt}</p>
          <input
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={guided}
            onChange={(e) => setGuided(e.target.value)}
            placeholder="Type your answer"
          />
          {!guidedOk && guided.length > 0 && (
            <p className="mt-2 text-xs text-rose-600">Try again — think about the place value column.</p>
          )}
          <button className="anx-btn-primary mt-3 w-full" onClick={onComplete} disabled={!guidedOk}>
            Continue to key questions
          </button>
        </div>
      )}
    </div>
  );
}
