import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const phase1Root = path.join(repoRoot, 'docs', 'unit-mapping', 'phase-1-authoring');
const briefsRoot = path.join(phase1Root, 'briefs');
const queuePath = path.join(phase1Root, 'phase-1-authoring-queue.json');

const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
fs.mkdirSync(briefsRoot, { recursive: true });

function modeRules(skillCode) {
  if (['N1.3', 'N1.7', 'N1.14'].includes(skillCode)) {
    return [
      'Use `TRUE_FALSE` for direct statement checks.',
      'Use `SHORT_TEXT` when the learner must supply the inequality symbol.',
      'Only use `MCQ` when there is a real misconception contrast, not as the default mode.',
    ];
  }
  if (['N1.4', 'N1.8', 'N1.15'].includes(skillCode)) {
    return [
      'Use ordered-response interaction where possible.',
      'If ordered UI is not available, use structured short-text with explicit comma-separated sequence expectations.',
      'Do not use standard 4-option MCQ for list ordering tasks.',
    ];
  }
  if (['N1.5', 'N1.10', 'N1.12', 'N2.4', 'N2.5', 'N2.6', 'N2.7'].includes(skillCode)) {
    return [
      'Default to `SHORT_NUMERIC` for main practice items.',
      'Use onboarding MCQ only for quick recognition checks or misconception probes.',
      'Reteach should break the method into smaller steps rather than repeating the same question.',
    ];
  }
  return [
    'Pick the simplest answer mode that matches the student task.',
    'Avoid forced 4-option MCQ unless the curriculum genuinely supports strong distractors.',
    'Reteach items should change representation, scaffold the method, or isolate the misconception.',
  ];
}

for (const entry of queue) {
  const filename = `${entry.skillCode.toLowerCase().replace('.', '-')}.md`;
  const lines = [
    `# ${entry.skillCode} Author Brief`,
    '',
    `- Source title: ${entry.sourceTitle ?? 'Unknown'}`,
    `- App skill: ${entry.appSkillName ?? 'Will appear after reseed'}`,
    `- Status: ${entry.status}`,
    `- Current real items: ${entry.currentRealItems}`,
    `- Current placeholders: ${entry.currentPlaceholderItems}`,
    `- Target counts: ${entry.targetCounts.onboarding} onboarding, ${entry.targetCounts.learn} learn, ${entry.targetCounts.reteach} reteach`,
    ...(entry.reviewPackFile ? [`- Review pack: \`${path.relative(repoRoot, entry.reviewPackFile)}\``] : []),
    '',
    '## Answer Mode Rules',
    '',
    ...modeRules(entry.skillCode).map((rule) => `- ${rule}`),
    '',
    '## Content Tasks',
    '',
    '- Onboarding:',
    '  - Write short prerequisite checks only.',
    '  - Keep reading load low and answers auto-markable.',
    '- Learn:',
    '  - Write the main independent practice progression.',
    '  - Increase complexity logically across the set.',
    '- Reteach:',
    '  - Write a fresh set of smaller-step or representation-shift questions.',
    '  - Do not repeat the original question verbatim.',
    '',
    '## Quality Checks',
    '',
    '- Correct answer must be selectable/enterable in the chosen mode.',
    '- Distractors must be plausible and skill-specific.',
    '- Accepted answers must match the exact intended student input.',
    '- No internal labels should appear in student-facing stems.',
    '- Mark where each item should route: onboarding, learn, or reteach.',
    '',
    '## Draft Notes',
    '',
    ...(entry.focusNotes.length ? entry.focusNotes.map((note) => `- ${note}`) : ['- Add notes here while authoring.']),
    '',
  ];

  fs.writeFileSync(path.join(briefsRoot, filename), `${lines.join('\n')}\n`);
}

console.log(`✅ Wrote ${queue.length} phase 1 author briefs to ${briefsRoot}`);
