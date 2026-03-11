import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const manifestPath = path.join(repoRoot, 'docs', 'unit-mapping', 'curriculum-extracts', 'manifest.json');
const outputPath = path.join(repoRoot, 'docs', 'unit-mapping', 'curriculum-extracts', 'seeding-gap-report.json');

function isCurriculumSkill(code) {
  return /^N[1-3]\.\d+$/.test(code);
}

function summarizeTypes(items) {
  const counts = {};
  for (const item of items) {
    counts[item.type] = (counts[item.type] ?? 0) + 1;
  }
  return counts;
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const extractedSkills = new Map();

  for (const deck of manifest.decks) {
    for (const entry of deck.contentsEntries) {
      if (!isCurriculumSkill(entry.skillCode)) continue;
      if (!extractedSkills.has(entry.skillCode)) {
        extractedSkills.set(entry.skillCode, entry.title);
      }
    }
    for (const code of deck.subtopicCoverage) {
      if (isCurriculumSkill(code) && !extractedSkills.has(code)) {
        extractedSkills.set(code, code);
      }
    }
  }

  const subject = await prisma.subject.findUnique({ where: { slug: 'ks3-maths' } });
  if (!subject) throw new Error('Subject ks3-maths not found. Run db:seed first.');

  const skills = await prisma.skill.findMany({
    where: { subjectId: subject.id },
    include: { items: { include: { item: true } } },
    orderBy: { sortOrder: 'asc' },
  });

  const skillMap = new Map(skills.map((skill) => [skill.code, skill]));
  const report = [];

  for (const [skillCode, sourceTitle] of [...extractedSkills.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))) {
    const appSkill = skillMap.get(skillCode) ?? null;
    const linkedItems = appSkill ? appSkill.items.map((link) => link.item) : [];
    const placeholderItems = linkedItems.filter((item) => item.question.includes('Placeholder question'));
    const realItems = linkedItems.filter((item) => !item.question.includes('Placeholder question'));

    report.push({
      skillCode,
      sourceTitle,
      appSkillName: appSkill?.name ?? null,
      itemCount: linkedItems.length,
      realItemCount: realItems.length,
      placeholderItemCount: placeholderItems.length,
      typeCounts: summarizeTypes(realItems),
      sampleQuestions: realItems.slice(0, 5).map((item) => item.question),
    });
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    totalSkills: report.length,
    seededSkills: report.filter((entry) => entry.realItemCount > 0).length,
    unseededSkills: report.filter((entry) => entry.realItemCount === 0).length,
    skillsMissingFromApp: report.filter((entry) => entry.appSkillName === null).length,
  };

  fs.writeFileSync(outputPath, JSON.stringify({ summary, report }, null, 2));
  console.log(`✅ Wrote seeding gap report to ${outputPath}`);
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
