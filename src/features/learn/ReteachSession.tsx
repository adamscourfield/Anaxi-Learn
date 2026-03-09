'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ReteachPlan, RouteType } from './reteachContent';
import { getInteractionRenderer, type StepInteractionState } from './interactionRegistry';

interface Props {
  subjectId: string;
  skillId: string;
  routeType: RouteType;
  plan: ReteachPlan;
  onComplete: () => void;
}

type ReteachStage = 'learn' | 'checkpoint' | 'worked' | 'guided';

export function ReteachSession({ subjectId, skillId, routeType, plan, onComplete }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [stage, setStage] = useState<ReteachStage>('learn');
  const [selected, setSelected] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [guided, setGuided] = useState('');
  const [retryCounts, setRetryCounts] = useState<Record<number, number>>({});
  const [altShown, setAltShown] = useState<Record<number, boolean>>({});
  const [stepStartMs, setStepStartMs] = useState<number>(Date.now());
  const [interactionByStep, setInteractionByStep] = useState<Record<number, StepInteractionState>>({});

  const step = plan.steps[stepIndex];
  const interaction = useMemo(
    () => interactionByStep[stepIndex] ?? { decompositionParts: [] },
    [interactionByStep, stepIndex]
  );

  const markInteraction = useCallback((patch: Partial<StepInteractionState>) => {
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
  }, [stepIndex]);

  const renderer = useMemo(() => getInteractionRenderer(step), [step]);
  const interactionStatus = useMemo(
    () => renderer.status({ step, state: interaction, markInteraction }),
    [renderer, step, interaction, markInteraction]
  );

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
        interactionType: step.interaction?.type ?? step.visualType ?? 'none',
        interactionDurationMs,
        completionRuleKind: step.interaction?.completionRule?.kind ?? 'selection_required',
        interactionSelected: interactionStatus.selected ?? null,
        interactionExpected: interactionStatus.firstDiff ?? null,
      }),
    });

    if (!correct) return;

    setTimeout(() => {
      setFeedback(null);
      setSelected('');
      if (stepIndex < plan.steps.length - 1) {
        setStepIndex((i) => i + 1);
        setStage('learn');
        setStepStartMs(Date.now());
      } else {
        setStage('worked');
      }
    }, 420);
  }

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\band\b/g, ' ')
      .replace(/,/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const guidedOk = normalize(guided) === normalize(plan.guidedAnswer);
  const needsWritingHint = /words|word form|expanded|extended/i.test(`${step.checkpointQuestion} ${plan.guidedPrompt}`);
  const interactionRequired = (step.interaction?.type ?? step.visualType ?? 'none') !== 'none';
  const canCheck = Boolean(selected) && (!interactionRequired || interactionStatus.completed);

  if (stage === 'worked') {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Worked example</p>
          <p className="mt-1">{plan.workedExample}</p>
          <button className="anx-btn-primary mt-4 w-full" onClick={() => setStage('guided')}>
            Next
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'guided') {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Try one yourself</p>
          <p className="mt-1 text-sm text-slate-700">{plan.guidedPrompt}</p>
          {needsWritingHint && <p className="mt-2 text-xs text-slate-600">Write it clearly. You can use “and” or leave it out.</p>}
          <input
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={guided}
            onChange={(e) => setGuided(e.target.value)}
            placeholder="Type your answer"
          />
          {!guidedOk && guided.length > 0 && <p className="mt-2 text-xs text-rose-600">Not quite — try again.</p>}
          <button className="anx-btn-primary mt-3 w-full" onClick={onComplete} disabled={!guidedOk}>
            Continue to key questions
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'checkpoint') {
    return (
      <div className="space-y-5">
        <div className={`rounded-2xl border border-slate-200 bg-white p-5 ${feedback === 'correct' ? 'anx-pulse-correct' : ''} ${feedback === 'incorrect' ? 'anx-shake-incorrect' : ''}`}>
          <p className="text-xs uppercase tracking-wide text-slate-500">Step {stepIndex + 1} of {plan.steps.length}</p>
          <p className="mt-3 text-sm font-semibold text-slate-900">Checkpoint</p>
          <p className="mt-1 text-sm text-slate-700">{step.checkpointQuestion}</p>
          <div className="mt-3 space-y-2">
            {step.checkpointOptions.map((option) => (
              <button key={option} onClick={() => setSelected(option)} className={`anx-option ${selected === option ? 'anx-option-selected' : ''}`}>
                {option}
              </button>
            ))}
          </div>
          <button onClick={checkStep} className="anx-btn-primary mt-4 w-full py-3 text-sm" disabled={!canCheck}>
            Check answer
          </button>
          {!selected && <p className="mt-2 text-xs text-slate-500">Choose one answer.</p>}
          {selected && interactionRequired && !interactionStatus.completed && (
            <p className="mt-2 text-xs text-amber-700">Do the visual task first. Then check your answer.</p>
          )}
          {feedback === 'incorrect' && <p className="mt-2 text-xs text-rose-600">Not yet. Use the hint and try again.</p>}
          {feedback === 'correct' && <p className="mt-2 text-xs text-emerald-600">Great — you got it.</p>}
          {altShown[stepIndex] && (
            <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
              <p className="font-semibold">Hint</p>
              <p>{step.alternativeHint ?? 'Say each place-value column name out loud, then try again.'}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500">Step {stepIndex + 1} of {plan.steps.length}</p>
        <h3 className="mt-1 text-base font-semibold text-slate-900">{step.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{step.explanation}</p>

        <div className="mt-4">{renderer.render({ step, state: interaction, markInteraction })}</div>

        <button
          className="anx-btn-primary mt-4 w-full"
          onClick={() => setStage('checkpoint')}
          disabled={interactionRequired && !interactionStatus.completed}
        >
          Next
        </button>
        {interactionRequired && !interactionStatus.completed && (
          <p className="mt-2 text-xs text-slate-600">Complete the visual task to continue.</p>
        )}
      </div>
    </div>
  );
}
