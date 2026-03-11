import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const curriculumRoot = path.join(repoRoot, 'Curriculum', 'Year 7', 'Unit 1 - Applications of Numeracy');
const publicRoot = path.join(repoRoot, 'public', 'curriculum-slide-media');
const manifestPath = path.join(repoRoot, 'docs', 'unit-mapping', 'curriculum-extracts', 'phase1-slide-media-manifest.json');

const packFiles = [
  'docs/unit-mapping/review-pack-phase1-n1-1-to-n1-5.jsonl',
  'docs/unit-mapping/review-pack-phase1-n1-6-to-n1-8.jsonl',
  'docs/unit-mapping/review-pack-phase1-n1-9-to-n1-12.jsonl',
  'docs/unit-mapping/review-pack-phase1-n1-13-to-n1-15.jsonl',
  'docs/unit-mapping/review-pack-phase1-n2-1-to-n2-4.jsonl',
  'docs/unit-mapping/review-pack-phase1-n2-5-to-n2-8.jsonl',
  'docs/unit-mapping/review-pack-phase1-n2-9-to-n2-13.jsonl',
];

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function parseSlideNumber(questionRef) {
  const match = questionRef.match(/^Slide(\d+)/i);
  return match ? Number(match[1]) : null;
}

function unzipText(pptxPath, entry) {
  return execFileSync('unzip', ['-p', pptxPath, entry], { encoding: 'utf8' });
}

function unzipBuffer(pptxPath, entry) {
  return execFileSync('unzip', ['-p', pptxPath, entry]);
}

function collectReferencedSlides() {
  const referencedSlides = new Map();

  for (const relativePath of packFiles) {
    const filePath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(filePath)) continue;

    const lines = fs.readFileSync(filePath, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      const row = JSON.parse(line);
      const sourceFile = row?.source?.source_file;
      const questionRef = row?.source?.question_ref;
      const slideNumber = parseSlideNumber(questionRef ?? '');
      if (!sourceFile || !slideNumber) continue;

      const key = `${sourceFile}::${slideNumber}`;
      if (!referencedSlides.has(key)) {
        referencedSlides.set(key, {
          sourceFile,
          slideNumber,
          questionRefs: new Set(),
        });
      }
      referencedSlides.get(key).questionRefs.add(questionRef);
    }
  }

  return [...referencedSlides.values()];
}

function extractSlideImages(sourceFile, slideNumber) {
  const pptxPath = path.join(curriculumRoot, sourceFile);
  if (!fs.existsSync(pptxPath)) {
    return [];
  }

  const relEntry = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
  let relXml = '';
  try {
    relXml = unzipText(pptxPath, relEntry);
  } catch {
    return [];
  }

  const imageTargets = [...relXml.matchAll(/Type="[^"]*\/image"\s+Target="([^"]+)"/g)].map((match) =>
    path.posix.normalize(path.posix.join('ppt/slides', match[1]))
  );

  if (imageTargets.length === 0) {
    return [];
  }

  const deckKey = slugify(path.basename(sourceFile, '.pptx'));
  const destinationDir = path.join(publicRoot, deckKey, `slide-${slideNumber}`);
  fs.mkdirSync(destinationDir, { recursive: true });

  return imageTargets.map((zipEntry, index) => {
    const fileName = path.basename(zipEntry);
    const destinationPath = path.join(destinationDir, fileName);
    fs.writeFileSync(destinationPath, unzipBuffer(pptxPath, zipEntry));

    return {
      src: `/curriculum-slide-media/${deckKey}/slide-${slideNumber}/${fileName}`,
      alt: `Diagram from slide ${slideNumber}`,
      caption: `Source diagram from slide ${slideNumber}`,
      assetIndex: index,
    };
  });
}

fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.mkdirSync(publicRoot, { recursive: true });

const slides = collectReferencedSlides()
  .map(({ sourceFile, slideNumber, questionRefs }) => ({
    sourceFile,
    slideNumber,
    questionRefs: [...questionRefs].sort(),
    media: extractSlideImages(sourceFile, slideNumber),
  }))
  .filter((entry) => entry.media.length > 0);

const manifest = {
  generatedAt: new Date().toISOString(),
  slideCountWithMedia: slides.length,
  slides,
};

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(
  JSON.stringify(
    {
      manifestPath,
      slideCountWithMedia: slides.length,
      assetCount: slides.reduce((sum, entry) => sum + entry.media.length, 0),
    },
    null,
    2
  )
);
