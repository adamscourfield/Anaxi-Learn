import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildExtractionResult } from '../features/content-ingestion/extractors/shared';
import { enrichQuestion } from '../features/content-ingestion/enrich/enrichQuestion';
import { validateImportedQuestion } from '../features/content-ingestion/validate/validateImportedQuestion';
import { publishImportedBatch } from '../features/content-ingestion/publish/publishImportedBatch';
import type { EnrichmentContext, RawExtractedQuestion } from '../features/content-ingestion/types';

const context: EnrichmentContext = {
  confidenceThreshold: 0.75,
  selectionRulesText: '',
  answerModeBank: [
    { id: 'NUMERIC', label: 'Numeric', aliases: [], raw: {} },
    { id: 'SHORT_TEXT', label: 'Short text', aliases: [], raw: {} },
    { id: 'TRUE_FALSE', label: 'True / False', aliases: [], raw: {} },
    { id: 'SINGLE_CHOICE', label: 'Single choice', aliases: [], raw: {} },
    { id: 'ORDER_SEQUENCE', label: 'Order sequence', aliases: [], raw: {} },
  ],
  objectiveMap: [
    {
      objectiveId: 'N1.5',
      subject: 'ks3-maths',
      yearBand: 'Y7',
      strand: 'Number',
      subtopic: 'Finding the median from a set of numbers',
      allowedModes: ['NUMERIC'],
      learningPhases: ['LEARN'],
      raw: {},
    },
  ],
};

describe('content ingestion enrichment', () => {
  it('normalizes extraction output and retains unresolved segments', () => {
    const result = buildExtractionResult('PPTX', 'sample.pptx', [
      {
        ref: 'slide-1',
        text: 'Subtopic N1.5 – Finding the median from a set of numbers | Find the median of 7, 12, 11, 6, 2.',
        contextText: 'Subtopic N1.5 – Finding the median from a set of numbers',
      },
      {
        ref: 'slide-2',
        text: 'Knowledge Organiser | What is an integer? | A whole number',
        contextText: 'Knowledge Organiser',
      },
    ]);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].stem).toContain('Find the median');
    expect(result.unresolvedSegments).toHaveLength(1);
    expect(result.unresolvedSegments[0].reason).toContain('knowledge-organiser');
  });

  it('maps a raw median question into an imported question', () => {
    const raw: RawExtractedQuestion = {
      provenance: {
        sourceType: 'PPTX',
        sourceFile: 'median.pptx',
        slideOrPageRef: 'slide-30',
      },
      rawText: 'Find the median of 7, 12, 11, 6, 2.',
      stem: 'Find the median of 7, 12, 11, 6, 2.',
      extractionConfidence: 0.9,
      detectedObjectiveHint: 'N1.5',
      extractedSubtopic: 'Finding the median from a set of numbers',
      extractedStrand: 'Number',
    };

    const imported = enrichQuestion(raw, context);

    expect(imported.curriculum.objectiveId).toBe('N1.5');
    expect(imported.adaptive.answerModeAllowed).toEqual(['NUMERIC']);
    expect(imported.pedagogical.learningPhase).toBe('LEARN');
  });

  it('suggests order-sequence mode for ordering prompts', () => {
    const raw: RawExtractedQuestion = {
      provenance: {
        sourceType: 'PPTX',
        sourceFile: 'ordering.pptx',
        slideOrPageRef: 'slide-25',
      },
      rawText: 'Order these integers in descending order: 872, 802, 870, 780, 827',
      stem: 'Order these integers in descending order: 872, 802, 870, 780, 827',
      extractionConfidence: 0.9,
      detectedObjectiveHint: 'N1.4',
      extractedSubtopic: 'Order a list of integers',
      extractedStrand: 'Number',
    };

    const imported = enrichQuestion(raw, {
      ...context,
      objectiveMap: [
        ...context.objectiveMap,
        {
          objectiveId: 'N1.4',
          subject: 'ks3-maths',
          yearBand: 'Y7',
          strand: 'Number',
          subtopic: 'Order a list of integers',
          allowedModes: ['ORDER_SEQUENCE'],
          learningPhases: ['LEARN'],
          raw: {},
        },
      ],
    });

    expect(imported.adaptive.answerModeAllowed).toEqual(['ORDER_SEQUENCE']);
  });

  it('routes low-confidence questions to review', () => {
    const raw: RawExtractedQuestion = {
      provenance: {
        sourceType: 'DOCX',
        sourceFile: 'unclear.docx',
        slideOrPageRef: 'page-2',
      },
      rawText: 'Discuss the pattern.',
      stem: 'Discuss the pattern.',
      extractionConfidence: 0.3,
      detectedObjectiveHint: null,
      extractedSubtopic: null,
      extractedStrand: null,
    };

    const imported = enrichQuestion(raw, context);
    expect(imported.quality.needsHumanReview).toBe(true);
    expect(imported.quality.status).toBe('REVIEW');
  });

  it('flags missing bank/objective issues during validation', () => {
    const raw: RawExtractedQuestion = {
      provenance: {
        sourceType: 'DOCX',
        sourceFile: 'unknown.docx',
        slideOrPageRef: 'page-1',
      },
      rawText: 'Explain your method.',
      stem: 'Explain your method.',
      extractionConfidence: 0.4,
      detectedObjectiveHint: null,
      extractedSubtopic: 'Unknown',
      extractedStrand: 'Number',
    };

    const imported = enrichQuestion(raw, {
      ...context,
      answerModeBank: [],
      objectiveMap: [],
    });
    const issues = validateImportedQuestion(imported, {
      ...context,
      answerModeBank: [],
      objectiveMap: [],
    });

    expect(issues.some((issue) => issue.code === 'missing_answer_mode_bank')).toBe(true);
    expect(issues.some((issue) => issue.code === 'missing_objective_id' || issue.code === 'unknown_objective')).toBe(true);
  });

  it('publishes only valid records and stages invalid ones', async () => {
    const valid = enrichQuestion(
      {
        provenance: {
          sourceType: 'PPTX',
          sourceFile: 'median.pptx',
          slideOrPageRef: 'slide-30',
        },
        rawText: 'Find the median of 7, 12, 11, 6, 2.',
        stem: 'Find the median of 7, 12, 11, 6, 2.',
        extractionConfidence: 0.9,
        detectedObjectiveHint: 'N1.5',
        extractedSubtopic: 'Finding the median from a set of numbers',
        extractedStrand: 'Number',
      },
      context
    );

    const invalid = enrichQuestion(
      {
        provenance: {
          sourceType: 'DOCX',
          sourceFile: 'bad.docx',
          slideOrPageRef: 'page-1',
        },
        rawText: 'Explain your method.',
        stem: 'Explain your method.',
        extractionConfidence: 0.2,
        detectedObjectiveHint: null,
        extractedSubtopic: 'Unknown',
        extractedStrand: 'Number',
      },
      context
    );

    const result = await publishImportedBatch([valid, invalid], context, {
      dryRun: true,
      batchLabel: 'vitest-content-ingestion',
    });

    expect(result.publishedCount).toBe(1);
    expect(result.stagedCount).toBe(1);
    expect(result.rejectedCount).toBe(1);
    expect(fs.existsSync(result.auditLogPath)).toBe(true);
    expect(fs.existsSync(result.stagingPath)).toBe(true);

    const staged = JSON.parse(fs.readFileSync(result.stagingPath, 'utf8')) as unknown[];
    expect(staged).toHaveLength(1);
  });
});
