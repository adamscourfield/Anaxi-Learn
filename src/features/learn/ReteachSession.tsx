'use client';

import { useState } from 'react';
import type { ReteachPlan, RouteType } from './reteachContent';

interface Props {
  subjectId: string;
  skillId: string;
  routeType: RouteType;
  plan: ReteachPlan;
  onComplete: () => void;
}

export function ReteachSession({ subjectId, skillId, routeType, plan, onComplete }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [selected, setSelected] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [guided, setGuided] = useState('');
  const [retryCounts, setRetryCounts] = useState<Record<number, number>>({});
  const [altShown, setAltShown] = useState<Record<number, boolean>>({});
  const [confidenceByStep, setConfidenceByStep] = useState<Record<number, 'low' | 'medium' | 'high'>>({});

  const step = plan.steps[stepIndex];

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
        confidence: confidenceByStep[stepIndex] ?? 'medium',
        alternativeShown: shouldShowAlt,
      }),
    });

    if (correct) {
      setTimeout(() => {
        setFeedback(null);
        setSelected('');
        if (stepIndex < plan.steps.length - 1) {
          setStepIndex((i) => i + 1);
        }
      }, 420);
    }
  }

  const doneSteps = stepIndex >= plan.steps.length - 1 && feedback === 'correct';
  const guidedOk = guided.trim() === plan.guidedAnswer;

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
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{step.explanation}</p>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Checkpoint</p>
          <p className="mt-1 text-sm text-slate-700">{step.checkpointQuestion}</p>
          <div className="mt-2 flex gap-2 text-xs">
            {(['low', 'medium', 'high'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setConfidenceByStep((s) => ({ ...s, [stepIndex]: level }))}
                className={`rounded-md border px-2 py-1 ${
                  (confidenceByStep[stepIndex] ?? 'medium') === level ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 bg-white text-slate-600'
                }`}
              >
                confidence: {level}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {step.checkpointOptions.map((option) => (
              <button key={option} onClick={() => setSelected(option)} className={`anx-option ${selected === option ? 'anx-option-selected' : ''}`}>
                {option}
              </button>
            ))}
          </div>
          <button onClick={checkStep} className="anx-btn-primary mt-4 w-full py-3 text-sm" disabled={!selected}>
            Check this step
          </button>
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
