import path from 'node:path';
import { ExtractionResult } from '../types';
import { buildExtractionResult, extractTextRuns, listZipEntries, normalizeInlineText, readZipEntry } from './shared';

export function extractFromDocx(filePath: string): ExtractionResult {
  const entries = listZipEntries(filePath, /^word\/document\.xml$/);
  const xml = entries[0] ? readZipEntry(filePath, entries[0]) : '';
  const paragraphs = normalizeInlineText(extractTextRuns(xml, 'w:t'))
    .split(/\s+\|\s+/)
    .reduce<string[]>((acc, fragment) => {
      if (!fragment) return acc;
      const last = acc[acc.length - 1];
      if (!last || /\?$/.test(last) || /^question\b/i.test(fragment)) {
        acc.push(fragment);
      } else {
        acc[acc.length - 1] = `${last} | ${fragment}`;
      }
      return acc;
    }, [])
    .map((text, index) => ({ ref: `page-1-block-${index + 1}`, text }));

  return buildExtractionResult('DOCX', path.basename(filePath), paragraphs);
}
