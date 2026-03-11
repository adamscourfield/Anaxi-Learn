import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const extractsRoot = path.join(repoRoot, 'docs', 'unit-mapping', 'curriculum-extracts');
const outputRoot = path.join(repoRoot, 'docs', 'unit-mapping', 'curriculum-review-packs');

function isCurriculumSkill(code) {
  return /^N[1-3]\.\d+$/.test(code);
}

function loadDecks() {
  return fs
    .readdirSync(extractsRoot)
    .filter((file) => file.endsWith('.json') && file !== 'manifest.json' && file !== 'seeding-gap-report.json')
    .map((file) => JSON.parse(fs.readFileSync(path.join(extractsRoot, file), 'utf8')));
}

function inferAnswerMode(text) {
  const normalized = text.toLowerCase();
  if (/\btrue\b|\bfalse\b|\bcorrect\b/.test(normalized) && /</.test(text)) return 'TRUE_FALSE';
  if (/\border\b|\bcoldest to warmest\b|\bascending\b|\bdescending\b/.test(normalized)) return 'ORDER_SEQUENCE';
  if (/\bwrite\b.+\bwords\b|\bwrite\b.+\bfigures\b|\bwhich symbol\b|\bwhich inequality\b/.test(normalized)) return 'SHORT_TEXT';
  if (/\bround\b|\bfind\b|\bcalculate\b|\bwhat is\b|\bhow many\b/.test(normalized)) return 'SHORT_NUMERIC';
  if (/\bwhich\b|\bselect\b|\bchoose\b/.test(normalized)) return 'MCQ';
  return 'SHORT_TEXT';
}

function inferPurpose(text) {
  const normalized = text.toLowerCase();
  if (/\bskills check\b|\bknowledge organiser\b|\bwhich is correct\b|\btrue\b|\bfalse\b/.test(normalized)) return 'ONBOARDING';
  if (/\byou do\b|\bindependent practice\b|\bproblem solving\b/.test(normalized)) return 'LEARN';
  return 'RETEACH';
}

function compact(text, limit = 320) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length <= limit ? cleaned : `${cleaned.slice(0, limit - 1)}…`;
}

function buildPack(skillCode, title, deckSlices) {
  const sourceDecks = [...new Set(deckSlices.map((slice) => slice.deck.id))];
  const slides = deckSlices.flatMap((slice) => slice.slides);
  const candidates = slides
    .filter((slide) => /\bExample\b|\bYou do\b|\bSkills Check\b|\?|Calculate|Find|Order|Round|Write|Compare/i.test(slide.text))
    .map((slide) => ({
      deckId: slide.deckId,
      slideNumber: slide.slideNumber,
      preview: compact(slide.text),
      suggestedAnswerMode: inferAnswerMode(slide.text),
      suggestedPurpose: inferPurpose(slide.text),
    }));

  const lines = [
    `# ${skillCode} Review Pack`,
    '',
    `- Source title: ${title}`,
    `- Decks: ${sourceDecks.join(', ') || 'None detected'}`,
    `- Slides detected: ${slides.length}`,
    `- Candidate question/model/reteach slides: ${candidates.length}`,
    '',
    '## Review Rules',
    '',
    '- Onboarding: short, auto-markable, low-reading-load checks that verify prerequisite understanding.',
    '- Learn: main independent practice questions with the clearest interaction mode for the task.',
    '- Reteach: smaller-step variants, representation shifts, and misconception-focused follow-ups.',
    '- Avoid generic distractors and avoid forcing four-option MCQ when the source only supports two answers or direct entry.',
    '',
    '## Source Slides',
    '',
    ...slides.map((slide) => `- ${slide.deckId} slide ${slide.slideNumber}: ${compact(slide.text, 220)}`),
    '',
    '## Candidate Items',
    '',
    ...candidates.map((candidate, index) => `- ${index + 1}. ${candidate.deckId} slide ${candidate.slideNumber} | mode: ${candidate.suggestedAnswerMode} | purpose: ${candidate.suggestedPurpose} | ${candidate.preview}`),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

fs.mkdirSync(outputRoot, { recursive: true });

const manifest = JSON.parse(fs.readFileSync(path.join(extractsRoot, 'manifest.json'), 'utf8'));
const decks = loadDecks();
const skillEntries = new Map();

for (const deck of manifest.decks) {
  for (const entry of deck.contentsEntries) {
    if (!isCurriculumSkill(entry.skillCode)) continue;
    if (!skillEntries.has(entry.skillCode)) skillEntries.set(entry.skillCode, entry.title);
  }
}

const index = [];

for (const [skillCode, title] of [...skillEntries.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))) {
  const deckSlices = decks
    .map((deck) => ({
      deck,
      slides: deck.slides
        .filter((slide) => slide.subtopicCode === skillCode || slide.text.includes(skillCode))
        .map((slide) => ({ ...slide, deckId: deck.id })),
    }))
    .filter((slice) => slice.slides.length > 0);

  const filename = `${skillCode.toLowerCase().replace('.', '-')}.md`;
  const output = buildPack(skillCode, title, deckSlices);
  fs.writeFileSync(path.join(outputRoot, filename), output);

  index.push({
    skillCode,
    title,
    file: path.join('docs', 'unit-mapping', 'curriculum-review-packs', filename),
    deckCount: deckSlices.length,
    slideCount: deckSlices.reduce((total, slice) => total + slice.slides.length, 0),
  });
}

fs.writeFileSync(path.join(outputRoot, 'index.json'), JSON.stringify(index, null, 2));
console.log(`✅ Wrote ${index.length} review packs to ${outputRoot}`);
