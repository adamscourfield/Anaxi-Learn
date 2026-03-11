#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, 'docs', 'unit-mapping', 'curriculum-extracts', 'manifest.json');
const outputPath = path.join(repoRoot, 'docs', 'unit-mapping', 'curriculum-extracts', 'seeding-gap-report.json');

async function main() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}. Run npm run content:extract:unit1 first.`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const targetSkills = manifest.skillInventory.filter((entry) => /^N[123]\./.test(entry.skillCode));

  const skills = await prisma.skill.findMany({
    where: {
      subject: { slug: 'ks3-maths' },
      code: { in: targetSkills.map((entry) => entry.skillCode) },
    },
    select: {
      code: true,
      name: true,
      items: {
        select: {
          item: {
            select: { id: true, type: true, question: true },
          },
        },
      },
    },
  });

  const byCode = new Map(skills.map((skill) => [skill.code, skill]));
  const report = targetSkills.map((entry) => {
    const skill = byCode.get(entry.skillCode);
    const items = skill?.items.map((link) => link.item) ?? [];
    const typeCounts = items.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] ?? 0) + 1;
      return acc;
    }, {});

    return {
      skillCode: entry.skillCode,
      sourceTitle: entry.title,
      appSkillName: skill?.name ?? null,
      itemCount: items.length,
      typeCounts,
      sampleQuestions: items.slice(0, 5).map((item) => item.question),
    };
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    totalSkills: report.length,
    seededSkills: report.filter((row) => row.itemCount > 0).length,
    unseededSkills: report.filter((row) => row.itemCount === 0).length,
  };

  fs.writeFileSync(outputPath, `${JSON.stringify({ summary, report }, null, 2)}\n`, 'utf8');
  console.log(`✅ Wrote seeding gap report to ${outputPath}`);
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
