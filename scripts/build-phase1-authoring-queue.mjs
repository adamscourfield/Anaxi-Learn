import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const extractsRoot = path.join(repoRoot, 'docs', 'unit-mapping', 'curriculum-extracts');
const reviewPacksRoot = path.join(repoRoot, 'docs', 'unit-mapping', 'curriculum-review-packs');
const outputRoot = path.join(repoRoot, 'docs', 'unit-mapping', 'phase-1-authoring');

const phase1SkillCodes = [
  'N1.1', 'N1.2', 'N1.3', 'N1.4', 'N1.5', 'N1.6', 'N1.7', 'N1.8', 'N1.9', 'N1.10',
  'N1.11', 'N1.12', 'N1.13', 'N1.14', 'N1.15',
  'N2.1', 'N2.2', 'N2.3', 'N2.4', 'N2.5', 'N2.6', 'N2.7', 'N2.8', 'N2.9', 'N2.10',
  'N2.11', 'N2.12', 'N2.13',
];

function phaseStatus(entry) {
  if (!entry) return 'MISSING_FROM_REPORT';
  if (entry.realItemCount >= 20) return 'REVIEW_AND_FIX';
  if (entry.realItemCount >= 1) return 'TOP_UP_AND_FIX';
  if (entry.appSkillName) return 'AUTHOR_FROM_SCRATCH';
  return 'ADD_SKILL_AND_AUTHOR';
}

function recommendedTargets(skillCode) {
  if (skillCode.startsWith('N1.')) {
    return { onboarding: 4, learn: 10, reteach: 6, total: 20 };
  }
  return { onboarding: 4, learn: 12, reteach: 8, total: 24 };
}

function focusNotes(skillCode, entry) {
  const modeHints = [];
  if (['N1.3', 'N1.7', 'N1.14'].includes(skillCode)) modeHints.push('Use TRUE_FALSE for statement checks and SHORT_TEXT for symbol insertion. Avoid padded 4-option MCQ.');
  if (['N1.4', 'N1.8', 'N1.15'].includes(skillCode)) modeHints.push('Use ORDER_SEQUENCE or structured short-entry, not standard MCQ.');
  if (['N1.9', 'N1.11', 'N1.13'].includes(skillCode)) modeHints.push('Prefer number-line interaction or short-entry labels rather than generic MCQ.');
  if (['N1.5', 'N1.10', 'N1.12', 'N2.4', 'N2.5', 'N2.6', 'N2.7'].includes(skillCode)) modeHints.push('Prefer SHORT_NUMERIC for core practice; MCQ only for onboarding checks or misconception probes.');
  if (['N2.1', 'N2.2', 'N2.3'].includes(skillCode)) modeHints.push('Build concept checks plus worked-example-style reteach items before independent practice.');
  if (['N2.8', 'N2.9', 'N2.10', 'N2.11', 'N2.12', 'N2.13'].includes(skillCode)) modeHints.push('Use contextual stems carefully; keep reading load low in onboarding and reteach.');

  if (entry?.placeholderItemCount) {
    modeHints.push(`Current DB still includes ${entry.placeholderItemCount} placeholder item(s) for this skill.`);
  }

  return modeHints;
}

fs.mkdirSync(outputRoot, { recursive: true });

const gapReport = JSON.parse(fs.readFileSync(path.join(extractsRoot, 'seeding-gap-report.json'), 'utf8'));
const coverage = new Map(gapReport.report.map((entry) => [entry.skillCode, entry]));

const queue = phase1SkillCodes.map((skillCode) => {
  const entry = coverage.get(skillCode) ?? null;
  const targets = recommendedTargets(skillCode);
  const status = phaseStatus(entry);
  const shortfall = entry ? Math.max(0, targets.total - entry.realItemCount) : targets.total;
  const reviewPackFile = path.join(reviewPacksRoot, `${skillCode.toLowerCase().replace('.', '-')}.md`);

  return {
    skillCode,
    sourceTitle: entry?.sourceTitle ?? null,
    appSkillName: entry?.appSkillName ?? null,
    status,
    currentRealItems: entry?.realItemCount ?? 0,
    currentPlaceholderItems: entry?.placeholderItemCount ?? 0,
    currentTypeCounts: entry?.typeCounts ?? {},
    targetCounts: targets,
    shortfall,
    sampleQuestions: entry?.sampleQuestions ?? [],
    reviewPackFile: fs.existsSync(reviewPackFile) ? reviewPackFile : null,
    focusNotes: focusNotes(skillCode, entry),
  };
});

const markdown = [
  '# Phase 1 Authoring Queue',
  '',
  'Scope: `N1.1` to `N1.15`, then `N2.1` to `N2.13`.',
  '',
  'Status meanings:',
  '- `REVIEW_AND_FIX`: substantial real content exists; prioritise routing, answer mode, distractors, and reteach quality.',
  '- `TOP_UP_AND_FIX`: some real content exists, but the set is too thin for onboarding/learn/reteach coverage.',
  '- `AUTHOR_FROM_SCRATCH`: skill exists in app but only has placeholders.',
  '- `ADD_SKILL_AND_AUTHOR`: source skill exists but the current DB does not yet have the app skill row.',
  '',
  '| Skill | Status | Real | Placeholder | Target | Next action |',
  '| --- | --- | ---: | ---: | ---: | --- |',
  ...queue.map((entry) => {
    const nextAction =
      entry.status === 'REVIEW_AND_FIX' ? 'QA existing items, repair modes/mappings, add missing onboarding/reteach only where needed'
      : entry.status === 'TOP_UP_AND_FIX' ? 'Keep valid items, write the missing onboarding/learn/reteach coverage'
      : entry.status === 'AUTHOR_FROM_SCRATCH' ? 'Write full question set from review pack'
      : 'Add skill via seed, then write full question set';
    return `| ${entry.skillCode} | ${entry.status} | ${entry.currentRealItems} | ${entry.currentPlaceholderItems} | ${entry.targetCounts.total} | ${nextAction} |`;
  }),
  '',
  '## Per-skill Notes',
  '',
  ...queue.flatMap((entry) => [
    `### ${entry.skillCode}`,
    `- Source title: ${entry.sourceTitle ?? 'Missing from extract report'}`,
    `- App skill: ${entry.appSkillName ?? 'Missing in current DB until reseed'}`,
    `- Status: ${entry.status}`,
    `- Current real items: ${entry.currentRealItems}`,
    `- Current placeholders: ${entry.currentPlaceholderItems}`,
    `- Target mix: ${entry.targetCounts.onboarding} onboarding, ${entry.targetCounts.learn} learn, ${entry.targetCounts.reteach} reteach`,
    `- Shortfall to target: ${entry.shortfall}`,
    ...(entry.focusNotes.map((note) => `- ${note}`)),
    ...(entry.reviewPackFile ? [`- Review pack: \`${path.relative(repoRoot, entry.reviewPackFile)}\``] : []),
    '',
  ]),
];

fs.writeFileSync(path.join(outputRoot, 'phase-1-authoring-queue.json'), JSON.stringify(queue, null, 2));
fs.writeFileSync(path.join(outputRoot, 'phase-1-authoring-queue.md'), `${markdown.join('\n')}\n`);

console.log(`✅ Wrote phase 1 authoring queue to ${outputRoot}`);
