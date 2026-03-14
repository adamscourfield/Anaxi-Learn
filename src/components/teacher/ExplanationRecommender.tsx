'use client';

import { useState } from 'react';

interface RecommendedExplanation {
  explanationId: string;
  skillId: string;
  dle: number;
  routeType: string;
  misconceptionSummary: string;
  workedExample: string;
}

interface Props {
  recommendedExplanation: RecommendedExplanation | null;
}

const routeTypeBadge: Record<string, string> = {
  PROCEDURAL: 'bg-blue-100 text-blue-800',
  CONCEPTUAL: 'bg-purple-100 text-purple-800',
  MISCONCEPTION_CORRECTION: 'bg-orange-100 text-orange-800',
};

export function ExplanationRecommender({ recommendedExplanation }: Props) {
  const [delivered, setDelivered] = useState(false);
  const [exampleOpen, setExampleOpen] = useState(false);

  if (!recommendedExplanation) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
        No explanation recommendation available yet.
      </div>
    );
  }

  const badgeClass = routeTypeBadge[recommendedExplanation.routeType] ?? 'bg-gray-100 text-gray-800';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>
            {recommendedExplanation.routeType.replace(/_/g, ' ')}
          </span>
          <span className="ml-2 text-xs text-gray-400">DLE: {recommendedExplanation.dle.toFixed(3)}</span>
        </div>
        {!delivered && (
          <button
            onClick={() => setDelivered(true)}
            className="shrink-0 rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
          >
            Mark as delivered
          </button>
        )}
        {delivered && (
          <span className="text-xs font-medium text-green-600">✓ Delivered</span>
        )}
      </div>
      <p className="mb-2 text-sm text-gray-700">{recommendedExplanation.misconceptionSummary}</p>
      <button
        onClick={() => setExampleOpen(!exampleOpen)}
        className="text-xs text-blue-600 hover:underline"
      >
        {exampleOpen ? 'Hide worked example ▲' : 'Show worked example ▼'}
      </button>
      {exampleOpen && (
        <div className="mt-2 rounded bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
          {recommendedExplanation.workedExample}
        </div>
      )}
    </div>
  );
}
