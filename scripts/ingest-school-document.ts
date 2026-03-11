import path from 'node:path';
import { extractFromPptx } from '../src/features/content-ingestion/extractors/extractFromPptx';
import { extractFromDocx } from '../src/features/content-ingestion/extractors/extractFromDocx';
import { loadIngestionContext } from '../src/features/content-ingestion/modeBank';
import { enrichBatch } from '../src/features/content-ingestion/enrich/enrichBatch';
import { publishImportedBatch } from '../src/features/content-ingestion/publish/publishImportedBatch';

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const file = readArg('--file');
  if (!file) {
    throw new Error('Missing required --file argument.');
  }

  const absoluteFile = path.resolve(process.cwd(), file);
  const dryRun = process.argv.includes('--dry-run');
  const context = loadIngestionContext();

  const extracted =
    absoluteFile.toLowerCase().endsWith('.pptx')
      ? extractFromPptx(absoluteFile)
      : absoluteFile.toLowerCase().endsWith('.docx')
        ? extractFromDocx(absoluteFile)
        : (() => {
            throw new Error(`Unsupported file type for ${absoluteFile}`);
          })();

  const enriched = enrichBatch(extracted.questions, context);
  const published = await publishImportedBatch(enriched, context, {
    dryRun,
    batchLabel: path.basename(absoluteFile, path.extname(absoluteFile)),
  });

  console.log(JSON.stringify({
    file: absoluteFile,
    extractedQuestions: extracted.questions.length,
    unresolvedSegments: extracted.unresolvedSegments.length,
    published,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
