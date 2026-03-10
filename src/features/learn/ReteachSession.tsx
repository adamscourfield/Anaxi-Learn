'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ReteachPlan, RouteType } from './reteachContent';
import { getInteractionRenderer, type StepInteractionState } from './interactionRegistry';

interface Props {
  subjectId: string;
  skillId: string;
  routeType: RouteType;
  assignedPathId?: string;
  plan: ReteachPlan;
  onComplete: () => void;
}

type ReteachStage = 'learn' | 'checkpoint' | 'worked' | 'guided';

export function ReteachSession({ subjectId, skillId, routeType, assignedPathId, plan, onComplete }: Props) {
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

  async function recordPhase9Attempt(input: { step: ReteachStage | 'retrieval'; correct: boolean; supportLevel: 'INDEPENDENT' | 'LIGHT_PROMPT' | 'WORKED_EXAMPLE' | 'SCAFFOLDED' | 'FULL_EXPLANATION'; isDelayedRetrieval?: boolean; }) {
    if (!assignedPathId) return;
    await fetch('/api/student/reteach/attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectId,
        skillId,
        assignedPathId,
        step:
          input.step === 'learn'
            ? 'TEACH'
            : input.step === 'guided'
              ? 'GUIDED'
              : input.step === 'retrieval'
                ? 'RETRIEVAL'
                : 'INDEPENDENT',
        stepIndex,
        correct: input.correct,
        supportLevel: input.supportLevel,
        isDelayedRetrieval: input.isDelayedRetrieval ?? false,
      }),
    });
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
        interactionType: step.interaction?.type ?? step.visualType ?? 'none',
        interactionDurationMs,
        completionRuleKind: step.interaction?.completionRule?.kind ?? 'selection_required',
        interactionSelected: interactionStatus.selected ?? null,
        interactionExpected: interactionStatus.firstDiff ?? null,
      }),
    });

    await recordPhase9Attempt({
      step: 'checkpoint',
      correct,
      supportLevel: 'SCAFFOLDED',
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
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-base text-slate-700">
          <p className="text-lg font-bold text-slate-900">👀 Worked example</p>
          <p className="mt-1 text-base leading-relaxed">{plan.workedExample}</p>
          <button className="anx-btn-primary mt-4 w-full py-3 text-base" onClick={() => setStage('guided')}>
            I get it — my turn
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'guided') {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-lg font-bold text-slate-900">✏️ Your turn</p>
          <p className="mt-1 text-base text-slate-700">{plan.guidedPrompt}</p>
          {needsWritingHint && <p className="mt-2 text-sm text-slate-600">Write it clearly. You can use “and” or leave it out.</p>}
          <input
            className="mt-3 w-full rounded-lg border border-slate-300 px-4 py-3 text-base"
            value={guided}
            onChange={(e) => setGuided(e.target.value)}
            placeholder="Type your answer"
          />
          {!guidedOk && guided.length > 0 && <p className="mt-2 text-sm text-rose-600">Nearly there — check each place value and try again.</p>}
          {guidedOk && <p className="mt-2 text-sm text-emerald-600">Brilliant! You got it ✅</p>}
          <button
            className="anx-btn-primary mt-3 w-full py-3 text-base"
            onClick={async () => {
              await recordPhase9Attempt({
                step: 'guided',
                correct: guidedOk,
                supportLevel: 'INDEPENDENT',
                isDelayedRetrieval: true,
              });

              if (assignedPathId) {
                const gateRes = await fetch('/api/student/reteach/evaluate-gate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ subjectId, skillId, assignedPathId }),
                });
                if (gateRes.ok) {
                  const gate = (await gateRes.json()) as { decision?: 'pass' | 'continue' | 'escalate' };
                  if (gate.decision === 'escalate') {
                    await fetch('/api/student/reteach/escalate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        subjectId,
                        skillId,
                        assignedPathId,
                        reason: 'Student did not meet reteach gate after loop completion',
                      }),
                    });
                  }
                }
              }

              onComplete();
            }}
            disabled={!guidedOk}
          >
            Start key questions 🚀
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'checkpoint') {
    return (
      <div className="space-y-5">
        <div className={`rounded-2xl border border-slate-200 bg-white p-6 ${feedback === 'correct' ? 'anx-pulse-correct' : ''} ${feedback === 'incorrect' ? 'anx-shake-incorrect' : ''}`}>
          <p className="text-sm uppercase tracking-wide text-slate-500">Step {stepIndex + 1} of {plan.steps.length}</p>
          <p className="mt-3 text-lg font-bold text-slate-900">🎯 Checkpoint</p>
          <p className="mt-1 text-base text-slate-700">{step.checkpointQuestion}</p>
          <div className="mt-3 space-y-2">
            {step.checkpointOptions.map((option) => (
              <button key={option} onClick={() => setSelected(option)} className={`anx-option ${selected === option ? 'anx-option-selected' : ''}`}>
                {option}
              </button>
            ))}
          </div>
          <button onClick={checkStep} className="anx-btn-primary mt-4 w-full py-3 text-base" disabled={!canCheck}>
            Check answer
          </button>
          {!selected && <p className="mt-2 text-sm text-slate-600">Choose one answer to begin.</p>}
          {selected && interactionRequired && !interactionStatus.completed && (
            <p className="mt-2 text-sm text-amber-700">First complete the visual task above, then check your answer.</p>
          )}
          {feedback === 'incorrect' && <p className="mt-2 text-sm text-rose-600">Not quite this time — mistakes help us learn. Try again 💪</p>}
          {feedback === 'correct' && <p className="mt-2 text-sm text-emerald-600">Excellent! That’s correct 🌟</p>}
          {altShown[stepIndex] && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
              <p className="font-semibold">💡 Helpful hint</p>
              <p>{step.alternativeHint ?? 'Say each place-value column name out loud, then try again.'}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm uppercase tracking-wide text-slate-500">Step {stepIndex + 1} of {plan.steps.length}</p>
        <h3 className="mt-1 text-xl font-bold text-slate-900">{step.title}</h3>
        <p className="mt-2 text-base leading-relaxed text-slate-700">{step.explanation}</p>

        <div className="mt-4">{renderer.render({ step, state: interaction, markInteraction })}</div>

        <button
          className="anx-btn-primary mt-4 w-full py-3 text-base"
          onClick={() => setStage('checkpoint')}
          disabled={interactionRequired && !interactionStatus.completed}
        >
          Next challenge
        </button>
        {interactionRequired && !interactionStatus.completed && (
          <p className="mt-2 text-sm text-slate-600">Complete the visual task to unlock the next challenge.</p>
        )}
      </div>
    </div>
  );
}
