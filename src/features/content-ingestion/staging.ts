import fs from 'node:fs';
import path from 'node:path';
import type { ImportedQuestion, ReviewIssue } from './types';

export interface StagedBatchEntry {
  question: ImportedQuestion;
  issues: ReviewIssue[];
}

export interface StagedBatchSummary {
  id: string;
  fileName: string;
  batchLabel: string;
  updatedAt: string;
  itemCount: number;
}

const stagingRoot = path.join(process.cwd(), 'docs', 'qa', 'content-ingestion-staging');

export function getStagingRoot() {
  return stagingRoot;
}

export function listStagedBatches(): StagedBatchSummary[] {
  if (!fs.existsSync(stagingRoot)) return [];
  return fs.readdirSync(stagingRoot)
    .filter((file) => file.startsWith('staged-') && file.endsWith('.json'))
    .map((fileName) => {
      const fullPath = path.join(stagingRoot, fileName);
      const stats = fs.statSync(fullPath);
      const items = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as StagedBatchEntry[];
      return {
        id: fileName,
        fileName,
        batchLabel: fileName.replace(/^staged-/, '').replace(/\.json$/, ''),
        updatedAt: stats.mtime.toISOString(),
        itemCount: items.length,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function readStagedBatch(fileName: string): StagedBatchEntry[] {
  const fullPath = path.join(stagingRoot, path.basename(fileName));
  if (!fs.existsSync(fullPath)) return [];
  return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as StagedBatchEntry[];
}
