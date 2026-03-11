import path from 'node:path';
import { ExtractionResult } from '../types';
import { buildExtractionResult, extractTextRuns, listZipEntries, normalizeInlineText, readZipEntry } from './shared';

export function extractFromPptx(filePath: string): ExtractionResult {
  const entries = listZipEntries(filePath, /^ppt\/slides\/slide\d+\.xml$/)
    .sort((a, b) => Number(a.match(/slide(\d+)/)?.[1] ?? 0) - Number(b.match(/slide(\d+)/)?.[1] ?? 0));

  let currentContextText = '';

  const parts = entries.map((entry) => {
    const slideNumber = Number(entry.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
    const xml = readZipEntry(filePath, entry);
    const text = normalizeInlineText(extractTextRuns(xml, 'a:t'));
    if (/\bSubtopic\s+N\d+\.\d+\b/i.test(text) || /\bSUBTOPIC\s+N\d+\.\d+\b/i.test(text)) {
      currentContextText = text;
    }
    return {
      ref: `slide-${slideNumber}`,
      text,
      contextText: currentContextText || text,
    };
  });

  return buildExtractionResult('PPTX', path.basename(filePath), parts);
}
