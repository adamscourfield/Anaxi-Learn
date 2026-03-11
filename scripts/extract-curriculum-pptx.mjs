#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const repoRoot = process.cwd();
const curriculumRoot = '/Users/adamscourfield/Documents/Anaxi-Learn/Curriculum/Year 7/Unit 1 - Applications of Numeracy';
const outputRoot = path.join(repoRoot, 'docs', 'unit-mapping', 'curriculum-extracts');

const decks = [
  { id: 'part-a-foundation', file: '(PART A) N1-3 Secondary Ready - Applications of Numeracy (FOUNDATION Not Meeting Expected Standard).pptx', part: 'A', tier: 'FOUNDATION', answers: false },
  { id: 'part-a-foundation-answers', file: '(PART A) N1-3 Secondary Ready - Applications of Numeracy (FOUNDATION Not Meeting Expected Standard) - Answers.pptx', part: 'A', tier: 'FOUNDATION', answers: true },
  { id: 'part-a-core', file: '(PART A) N1-3 Secondary Ready - Applications of Numeracy (CORE Meeting Expected Standard).pptx', part: 'A', tier: 'CORE', answers: false },
  { id: 'part-a-core-answers', file: '(PART A) N1-3 Secondary Ready - Applications of Numeracy (CORE Meeting Expected Standard) - Answers.pptx', part: 'A', tier: 'CORE', answers: true },
  { id: 'part-b-foundation', file: '(PART B) N1-3 Secondary Ready - Applications of Numeracy (FOUNDATION Not Meeting Expected Standard).pptx', part: 'B', tier: 'FOUNDATION', answers: false },
  { id: 'part-b-foundation-answers', file: '(PART B) N1-3 Secondary Ready - Applications of Numeracy (FOUNDATION Not Meeting Expected Standard) - Answers.pptx', part: 'B', tier: 'FOUNDATION', answers: true },
  { id: 'part-b-core', file: '(PART B) N1-3 Secondary Ready - Applications of Numeracy (CORE Meeting Expected Standard).pptx', part: 'B', tier: 'CORE', answers: false },
  { id: 'part-b-core-answers', file: '(PART B) N1-3 Secondary Ready - Applications of Numeracy (CORE Meeting Expected Standard) - Answers.pptx', part: 'B', tier: 'CORE', answers: true },
];

function decodeXmlEntities(value) {
  return value
    .replace(/&#xA;/g, '\n')
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function normalizeText(value) {
  return value
    .replace(/\u200b/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+\|\s+/g, ' | ')
    .trim();
}

function extractSlideText(filePath, slidePath) {
  const xml = execFileSync('unzip', ['-p', filePath, slidePath], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });

  const text = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
    .map((match) => decodeXmlEntities(match[1]))
    .join(' | ');

  return normalizeText(text);
}

function listSlides(filePath) {
  return execFileSync('unzip', ['-Z1', filePath], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^ppt\/slides\/slide\d+\.xml$/.test(line))
    .sort((a, b) => {
      const aNum = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const bNum = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return aNum - bNum;
    });
}

function detectSubtopicCode(text) {
  const match = text.match(/\bSubtopic\s+(N[1-4]\.\d+)\b/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function detectQuestionRefs(text) {
  const refs = new Set();

  for (const match of text.matchAll(/\b(\d{1,2}[a-z]?)\)/gi)) {
    refs.add(match[1].toLowerCase());
  }

  return [...refs];
}

function parseContents(text) {
  const out = [];
  for (const match of text.matchAll(/SUBTOPIC\s+(N[1-4]\.\d+)\s*\|\s*([^|]+)/gi)) {
    out.push({
      skillCode: match[1].toUpperCase(),
      title: normalizeText(match[2]),
    });
  }
  return out;
}

function summarizeDeck(deck, slides) {
  const contentsSlides = slides.filter((slide) => slide.contentsEntries.length > 0);
  const contentsEntries = contentsSlides.flatMap((slide) => slide.contentsEntries);
  const subtopicCoverage = new Set(slides.map((slide) => slide.subtopicCode).filter(Boolean));
  const questionSignals = slides.filter((slide) => slide.questionRefs.length > 0).length;

  return {
    id: deck.id,
    file: deck.file,
    part: deck.part,
    tier: deck.tier,
    answers: deck.answers,
    slideCount: slides.length,
    questionSignalSlides: questionSignals,
    contentsEntries,
    subtopicCoverage: [...subtopicCoverage].sort(),
  };
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeMarkdown(filePath, manifest) {
  const lines = [
    '# Unit 1 Curriculum Extract',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Decks',
  ];

  for (const deck of manifest.decks) {
    lines.push(`- \`${deck.id}\`: ${deck.slideCount} slides, ${deck.questionSignalSlides} slides with question markers, ${deck.subtopicCoverage.length} subtopics detected`);
  }

  lines.push('', '## Skill Coverage');

  for (const skill of manifest.skillInventory) {
    lines.push(`- \`${skill.skillCode}\` ${skill.title}`);
  }

  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

async function main() {
  ensureDir(outputRoot);

  const extractedDecks = [];
  const globalSkillMap = new Map();

  for (const deck of decks) {
    const filePath = path.join(curriculumRoot, deck.file);
    const slidePaths = listSlides(filePath);

    const slides = slidePaths.map((slidePath) => {
      const slideNumber = Number(slidePath.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const text = extractSlideText(filePath, slidePath);
      const contentsEntries = parseContents(text);
      const subtopicCode = detectSubtopicCode(text);
      const questionRefs = detectQuestionRefs(text);

      for (const entry of contentsEntries) {
        if (!globalSkillMap.has(entry.skillCode)) {
          globalSkillMap.set(entry.skillCode, entry.title);
        }
      }

      return {
        slideNumber,
        text,
        subtopicCode,
        questionRefs,
        contentsEntries,
      };
    });

    const summary = summarizeDeck(deck, slides);
    extractedDecks.push(summary);

    writeJson(path.join(outputRoot, `${deck.id}.json`), {
      ...summary,
      slides,
    });
  }

  const skillInventory = [...globalSkillMap.entries()]
    .map(([skillCode, title]) => ({ skillCode, title }))
    .sort((a, b) => {
      const [aMajor, aMinor] = a.skillCode.slice(1).split('.').map(Number);
      const [bMajor, bMinor] = b.skillCode.slice(1).split('.').map(Number);
      return aMajor - bMajor || aMinor - bMinor;
    });

  const manifest = {
    generatedAt: new Date().toISOString(),
    curriculumRoot,
    decks: extractedDecks,
    skillInventory,
  };

  writeJson(path.join(outputRoot, 'manifest.json'), manifest);
  writeMarkdown(path.join(outputRoot, 'README.md'), manifest);
  console.log(`✅ Extracted ${extractedDecks.length} curriculum decks to ${outputRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
