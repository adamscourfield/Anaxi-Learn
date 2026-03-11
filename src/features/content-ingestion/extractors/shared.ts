import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { ExtractionResult, RawExtractedQuestion, SourceType, UnresolvedSegment } from '../types';

function decodeXml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2013;/gi, '–')
    .replace(/&#x2014;/gi, '—')
    .replace(/&#x2264;/gi, '≤')
    .replace(/&#x2265;/gi, '≥')
    .replace(/&#x2260;/gi, '≠')
    .replace(/&#xD7;/gi, '×')
    .replace(/&#xF7;/gi, '÷')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export function extractTextRuns(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[^>]*>(.*?)<\\/${tagName}>`, 'g');
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const chunk = decodeXml(match[1]).replace(/\s+/g, ' ').trim();
    if (chunk) values.push(chunk);
  }
  return values;
}

export function normalizeInlineText(values: string[]): string {
  return values
    .join(' | ')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/\{[0-9A-F-]{8,}\}/gi, ' ')
    .replace(/\s+\|\s+/g, ' | ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function listZipEntries(filePath: string, pattern: RegExp): string[] {
  return execFileSync('unzip', ['-Z1', filePath], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => pattern.test(line));
}

export function readZipEntry(filePath: string, entry: string): string {
  return execFileSync('unzip', ['-p', filePath, entry], { encoding: 'utf8' });
}

function detectObjectiveHint(text: string): string | null {
  const match = text.match(/\bSubtopic\s+(N\d+\.\d+)\b/i) ?? text.match(/\bSUBTOPIC\s+(N\d+\.\d+)\b/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function detectSubtopic(text: string): string | null {
  const subtopicMatch = text.match(/\bSubtopic\s+N\d+\.\d+\s*[–-]?\s*([^|]+)/i);
  return subtopicMatch?.[1]?.trim() ?? null;
}

function detectOptions(text: string): string[] {
  const optionMatches = [...text.matchAll(/(?:^|\|\s*)([A-Da-d])\)\s*([^|]+)/g)];
  return optionMatches.map((match) => match[2].trim()).filter(Boolean);
}

function detectAnswer(text: string, options: string[]): string | undefined {
  if (/true or false/i.test(text) && options.length === 0) return undefined;
  const answerMatch = text.match(/\bAnswer\s*[:\-]\s*([^|]+)/i);
  if (answerMatch) return answerMatch[1].trim();
  return undefined;
}

function isNoiseFragment(text: string): boolean {
  return /knowledge organiser|contents|big picture|supporting resources|learning outcome|keywords:|introduction – read and annotate|definition|characteristics|non - examples/i.test(text);
}

function isQuestionLead(text: string): boolean {
  return (
    /\?$/.test(text) ||
    /^true or false/i.test(text) ||
    /^which /i.test(text) ||
    /^write /i.test(text) ||
    /^calculate /i.test(text) ||
    /^find /i.test(text) ||
    /^order /i.test(text) ||
    /^complete /i.test(text) ||
    /^what is /i.test(text) ||
    /^how much /i.test(text)
  );
}

function segmentQuestionText(text: string): string[] {
  const questionFragments = text
    .split(/\s+\|\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !isNoiseFragment(part));

  const segments: string[] = [];
  let current: string[] = [];

  for (const fragment of questionFragments) {
    if (isQuestionLead(fragment) && current.length > 0) {
      segments.push(current.join(' | '));
      current = [];
    }

    current.push(fragment);

    const stopAfterThis =
      /\?$/.test(fragment) ||
      /^true or false/i.test(fragment) ||
      /^which of the following/i.test(fragment) ||
      /^[A-Da-d]\)/.test(fragment);

    if (stopAfterThis) {
      segments.push(current.join(' | '));
      current = [];
    }
  }

  if (current.length > 0 && questionFragments.length <= 6 && isQuestionLead(current[0])) {
    segments.push(current.join(' | '));
  }

  return [...new Set(segments.map((segment) => segment.trim()).filter(Boolean))];
}

export function buildExtractionResult(
  sourceType: SourceType,
  sourceFile: string,
  parts: Array<{ ref: string; text: string; contextText?: string }>
): ExtractionResult {
  const questions: RawExtractedQuestion[] = [];
  const unresolvedSegments: UnresolvedSegment[] = [];

  for (const part of parts) {
    const text = part.text.trim();
    if (!text) continue;
    const contextText = part.contextText ?? text;

    const noObjectiveContext = !detectObjectiveHint(contextText) && !detectSubtopic(contextText);
    const looksLikeKnowledgeOrganiser =
      /knowledge organiser|knowledge \| answer/i.test(text) ||
      ((text.match(/what is /gi)?.length ?? 0) >= 3 && noObjectiveContext);

    if (looksLikeKnowledgeOrganiser) {
      unresolvedSegments.push({
        sourceType,
        sourceFile: path.basename(sourceFile),
        slideOrPageRef: part.ref,
        rawText: text,
        reason: 'Skipped likely knowledge-organiser content rather than a deliverable question slide.',
      });
      continue;
    }

    const segments = segmentQuestionText(text);
    let foundQuestion = false;

    for (const segment of segments) {
      const options = detectOptions(segment);
      const objectiveHint = detectObjectiveHint(segment) ?? detectObjectiveHint(contextText);
      const subtopic = detectSubtopic(segment) ?? detectSubtopic(contextText);
      const questionish =
        isQuestionLead(segment) ||
        /\?/.test(segment);

      if (!questionish) continue;

      if (segment.length < 8 || isNoiseFragment(segment)) continue;

      const stem = segment
        .replace(/\s+\|\s+[A-Da-d]\)\s*[^|]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (isNoiseFragment(stem) || !isQuestionLead(stem)) continue;

      questions.push({
        provenance: {
          sourceType,
          sourceFile: path.basename(sourceFile),
          slideOrPageRef: part.ref,
        },
        rawText: segment,
        stem,
        options: options.length > 0 ? options : undefined,
        detectedAnswer: detectAnswer(segment, options),
        detectedDistractors: options.length > 1 ? options.slice(1) : undefined,
        detectedObjectiveHint: objectiveHint,
        extractedSubtopic: subtopic,
        extractedStrand: objectiveHint?.startsWith('N1') || objectiveHint?.startsWith('N2') || objectiveHint?.startsWith('N3') ? 'Number' : null,
        extractionConfidence: options.length > 0 || /\?/.test(stem) ? 0.8 : 0.55,
      });
      foundQuestion = true;
    }

    if (!foundQuestion) {
      unresolvedSegments.push({
        sourceType,
        sourceFile: path.basename(sourceFile),
        slideOrPageRef: part.ref,
        rawText: text,
        reason: 'No question stem could be parsed with current heuristics.',
      });
    }
  }

  return { questions, unresolvedSegments };
}
