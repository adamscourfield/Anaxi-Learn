import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const curriculumRoot = path.join(repoRoot, 'Curriculum', 'Year 7', 'Unit 1 - Applications of Numeracy');
const outputRoot = path.join(repoRoot, 'docs', 'unit-mapping', 'curriculum-extracts');

const decks = [
  {
    id: 'part-a-foundation',
    file: '(PART A) N1-3 Secondary Ready - Applications of Numeracy (FOUNDATION Not Meeting Expected Standard).pptx',
    part: 'A',
    tier: 'FOUNDATION',
    answers: false,
  },
  {
    id: 'part-a-foundation-answers',
    file: '(PART A) N1-3 Secondary Ready - Applications of Numeracy (FOUNDATION Not Meeting Expected Standard) - Answers.pptx',
    part: 'A',
    tier: 'FOUNDATION',
    answers: true,
  },
  {
    id: 'part-a-core',
    file: '(PART A) N1-3 Secondary Ready - Applications of Numeracy (CORE Meeting Expected Standard).pptx',
    part: 'A',
    tier: 'CORE',
    answers: false,
  },
  {
    id: 'part-a-core-answers',
    file: '(PART A) N1-3 Secondary Ready - Applications of Numeracy (CORE Meeting Expected Standard) - Answers.pptx',
    part: 'A',
    tier: 'CORE',
    answers: true,
  },
  {
    id: 'part-b-foundation',
    file: '(PART B) N1-3 Secondary Ready - Applications of Numeracy (FOUNDATION Not Meeting Expected Standard).pptx',
    part: 'B',
    tier: 'FOUNDATION',
    answers: false,
  },
  {
    id: 'part-b-foundation-answers',
    file: '(PART B) N1-3 Secondary Ready - Applications of Numeracy (FOUNDATION Not Meeting Expected Standard) - Answers.pptx',
    part: 'B',
    tier: 'FOUNDATION',
    answers: true,
  },
  {
    id: 'part-b-core',
    file: '(PART B) N1-3 Secondary Ready - Applications of Numeracy (CORE Meeting Expected Standard).pptx',
    part: 'B',
    tier: 'CORE',
    answers: false,
  },
  {
    id: 'part-b-core-answers',
    file: '(PART B) N1-3 Secondary Ready - Applications of Numeracy (CORE Meeting Expected Standard) - Answers.pptx',
    part: 'B',
    tier: 'CORE',
    answers: true,
  },
];

function decodeXml(text) {
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
    .replace(/&#xF7;/gi, '÷');
}

function cleanText(text) {
  return text
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/\{[0-9A-F-]{8,}\}/gi, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+\|\s+/g, ' | ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractText(xml) {
  const chunks = [];
  const regex = /<a:t[^>]*>(.*?)<\/a:t>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const chunk = decodeXml(match[1]).replace(/\s+/g, ' ').trim();
    if (chunk) chunks.push(chunk);
  }
  return cleanText(chunks.join(' | '));
}

function detectContentsEntries(text) {
  const matches = [...text.matchAll(/SUBTOPIC\s+(N\d+\.\d+)\s*\|\s*([^|]+)/gi)];
  return matches.map((match) => ({
    skillCode: match[1].toUpperCase(),
    title: match[2].trim(),
  }));
}

function detectSubtopicCode(text) {
  const explicit = text.match(/\bSubtopic\s+(N\d+\.\d+)\b/i);
  if (explicit) return explicit[1].toUpperCase();

  const heading = text.match(/\bSUBTOPIC\s+(N\d+\.\d+)\b/i);
  if (heading) return heading[1].toUpperCase();

  return null;
}

function detectQuestionRefs(text, slideNumber) {
  const refs = [];
  const numbered = [...text.matchAll(/(?:^|\|\s*)(\d+[a-z]?)\)/gi)];
  for (const [_, label] of numbered) refs.push(`Slide${slideNumber}-Q${label}`);
  return refs;
}

function readSlideXmlEntries(pptxPath) {
  const listing = execFileSync('unzip', ['-Z1', pptxPath], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^ppt\/slides\/slide\d+\.xml$/.test(line))
    .sort((a, b) => Number(a.match(/slide(\d+)/)?.[1] ?? 0) - Number(b.match(/slide(\d+)/)?.[1] ?? 0));

  return listing.map((entry) => {
    const xml = execFileSync('unzip', ['-p', pptxPath, entry], { encoding: 'utf8' });
    const slideNumber = Number(entry.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
    return { slideNumber, xml };
  });
}

function extractDeck(deck) {
  const pptxPath = path.join(curriculumRoot, deck.file);
  if (!fs.existsSync(pptxPath)) {
    throw new Error(`PPTX not found: ${pptxPath}`);
  }

  const slides = readSlideXmlEntries(pptxPath).map(({ slideNumber, xml }) => {
    const text = extractText(xml);
    return {
      slideNumber,
      text,
      subtopicCode: detectSubtopicCode(text),
      questionRefs: detectQuestionRefs(text, slideNumber),
      contentsEntries: detectContentsEntries(text),
    };
  });

  const contentsEntries = [];
  for (const slide of slides) {
    for (const entry of slide.contentsEntries) {
      if (!contentsEntries.some((existing) => existing.skillCode === entry.skillCode && existing.title === entry.title)) {
        contentsEntries.push(entry);
      }
    }
  }

  const subtopicCoverage = [...new Set(slides.map((slide) => slide.subtopicCode).filter(Boolean))].sort();
  const questionSignalSlides = slides.filter((slide) => slide.questionRefs.length > 0 || /\bExample\b|\bYou do\b|\?/.test(slide.text)).length;

  return {
    ...deck,
    slideCount: slides.length,
    questionSignalSlides,
    contentsEntries,
    subtopicCoverage,
    slides,
  };
}

function writeReadme(manifest) {
  const coverage = [...new Set(manifest.decks.flatMap((deck) => deck.contentsEntries.map((entry) => `${entry.skillCode} - ${entry.title}`)))].sort();
  const lines = [
    '# Unit 1 Curriculum Extracts',
    '',
    `Generated: ${manifest.generatedAt}`,
    `Curriculum root: \`${manifest.curriculumRoot}\``,
    '',
    '## Deck Summary',
    '',
    '| Deck | Slides | Question-signal slides | Subtopics detected |',
    '| --- | ---: | ---: | ---: |',
    ...manifest.decks.map((deck) => `| ${deck.id} | ${deck.slideCount} | ${deck.questionSignalSlides} | ${deck.subtopicCoverage.length} |`),
    '',
    '## Skill Coverage',
    '',
    ...coverage.map((entry) => `- ${entry}`),
    '',
  ];
  fs.writeFileSync(path.join(outputRoot, 'README.md'), `${lines.join('\n')}\n`);
}

fs.mkdirSync(outputRoot, { recursive: true });

const extractedDecks = decks.map(extractDeck);
const manifest = {
  generatedAt: new Date().toISOString(),
  curriculumRoot,
  decks: extractedDecks.map(({ id, file, part, tier, answers, slideCount, questionSignalSlides, contentsEntries, subtopicCoverage }) => ({
    id,
    file,
    part,
    tier,
    answers,
    slideCount,
    questionSignalSlides,
    contentsEntries,
    subtopicCoverage,
  })),
};

for (const deck of extractedDecks) {
  fs.writeFileSync(path.join(outputRoot, `${deck.id}.json`), JSON.stringify(deck, null, 2));
}

fs.writeFileSync(path.join(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));
writeReadme(manifest);

console.log(`✅ Extracted ${extractedDecks.length} curriculum decks to ${outputRoot}`);
