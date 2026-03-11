import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function collectOfficeFiles(inputPath) {
  const absolute = path.resolve(process.cwd(), inputPath);
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];

  const files = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const fullPath = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectOfficeFiles(fullPath));
      continue;
    }
    if (/\.(pptx|docx)$/i.test(entry.name)) files.push(fullPath);
  }
  return files.sort();
}

function runSingleImport(filePath, dryRun) {
  const output = execFileSync(
    'npx',
    [
      'ts-node',
      '--compiler-options',
      '{"module":"CommonJS"}',
      path.join(repoRoot, 'scripts', 'ingest-school-document.ts'),
      '--file',
      filePath,
      ...(dryRun ? ['--dry-run'] : []),
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    }
  );

  return JSON.parse(output);
}

function main() {
  const input = readArg('--input') ?? readArg('--file') ?? readArg('--folder');
  if (!input) {
    throw new Error('Missing required --input argument (file or folder).');
  }

  const dryRun = process.argv.includes('--dry-run');
  const outputDir = path.resolve(process.cwd(), readArg('--output-dir') ?? path.join('docs', 'qa', 'content-ingestion-staging'));
  fs.mkdirSync(outputDir, { recursive: true });

  const files = collectOfficeFiles(input);
  const runs = files.map((filePath) => runSingleImport(filePath, dryRun));

  const importReport = {
    generatedAt: new Date().toISOString(),
    input: path.resolve(process.cwd(), input),
    dryRun,
    filesProcessed: files.length,
    summary: {
      imported: runs.reduce((sum, run) => sum + (run.published?.publishedCount ?? 0), 0),
      review: runs.reduce((sum, run) => sum + (run.published?.stagedCount ?? 0), 0),
      failed: runs.reduce((sum, run) => sum + (run.published?.rejectedCount ?? 0), 0),
      extractedQuestions: runs.reduce((sum, run) => sum + (run.extractedQuestions ?? 0), 0),
      unresolvedSegments: runs.reduce((sum, run) => sum + (run.unresolvedSegments ?? 0), 0),
    },
    files: runs,
  };

  const reviewQueue = runs.flatMap((run) => {
    const stagingPath = run.published?.stagingPath;
    if (!stagingPath || !fs.existsSync(stagingPath)) return [];
    return JSON.parse(fs.readFileSync(stagingPath, 'utf8')).map((entry) => ({
      sourceFile: run.file,
      ...entry,
    }));
  });

  const importReportPath = path.join(outputDir, 'import-report.json');
  const reviewQueuePath = path.join(outputDir, 'review-queue.json');
  fs.writeFileSync(importReportPath, JSON.stringify(importReport, null, 2));
  fs.writeFileSync(reviewQueuePath, JSON.stringify(reviewQueue, null, 2));

  console.log(JSON.stringify({
    importReportPath,
    reviewQueuePath,
    summary: importReport.summary,
  }, null, 2));
}

main();
