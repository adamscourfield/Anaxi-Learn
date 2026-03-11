import fs from 'node:fs';
import path from 'node:path';
import { ObjectiveMapRow, AnswerModeBankEntry, EnrichmentContext } from './types';

const repoRoot = path.resolve(process.cwd());
const bankRoot = path.join(repoRoot, 'docs', 'learning-design', 'answer-mode-bank');

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[|,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function loadAnswerModeBankEntries(filePath: string): AnswerModeBankEntry[] {
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  const records = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { modes?: unknown }).modes)
      ? ((payload as { modes: unknown[] }).modes)
      : [];

  return records
    .filter((record): record is Record<string, unknown> => typeof record === 'object' && record !== null)
    .map((record, index) => {
      const id = String(record.id ?? record.mode ?? record.name ?? `mode-${index + 1}`);
      const label = String(record.label ?? record.name ?? id);
      const aliases = toStringList(record.aliases ?? record.synonyms ?? record.mode);
      return {
        id,
        label,
        aliases,
        raw: record,
      };
    });
}

function loadObjectiveMapRows(filePath: string): ObjectiveMapRow[] {
  return parseCsv(filePath).map((row) => {
    const objectiveId =
      row.objectiveId ||
      row.objective_id ||
      row.skillCode ||
      row.skill_code ||
      row.code ||
      '';
    return {
      objectiveId,
      subject: row.subject || row.subjectSlug || row.subject_slug || '',
      yearBand: row.yearBand || row.year_band || row.year || '',
      strand: row.strand || '',
      subtopic: row.subtopic || row.objective || row.title || '',
      allowedModes: toStringList(row.allowedModes || row.allowed_modes || row.answerModes || row.answer_modes),
      learningPhases: toStringList(row.learningPhases || row.learning_phases || row.phase || row.phases),
      raw: row,
    };
  });
}

export function loadIngestionContext(confidenceThreshold = 0.75): EnrichmentContext {
  const answerModeBankPath = path.join(bankRoot, 'answer-mode-bank.json');
  const objectiveMapPath = path.join(bankRoot, 'curriculum-objective-map.csv');
  const rulesPath = path.join(bankRoot, 'mode-selection-rules.yaml');

  return {
    objectiveMap: fs.existsSync(objectiveMapPath) ? loadObjectiveMapRows(objectiveMapPath) : [],
    answerModeBank: fs.existsSync(answerModeBankPath) ? loadAnswerModeBankEntries(answerModeBankPath) : [],
    selectionRulesText: fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, 'utf8') : '',
    confidenceThreshold,
  };
}

export function resolveKnownAnswerModeIds(context: EnrichmentContext): Set<string> {
  const known = new Set<string>();
  for (const mode of context.answerModeBank) {
    known.add(normalize(mode.id));
    known.add(normalize(mode.label));
    for (const alias of mode.aliases) known.add(normalize(alias));
  }
  return known;
}

export function objectiveExists(context: EnrichmentContext, objectiveId: string | null): boolean {
  if (!objectiveId) return false;
  return context.objectiveMap.some((row) => normalize(row.objectiveId) === normalize(objectiveId));
}
