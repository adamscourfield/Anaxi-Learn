import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { MappingRow, deriveStoredItemFromMapping, getItemContractIssues } from '@/features/content/questionContract';

const prisma = new PrismaClient();

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

async function main() {
  const mappingPath = path.resolve(process.cwd(), 'docs/unit-mapping/review-pack-unit1-partA-foundation-first25.jsonl');
  if (!fs.existsSync(mappingPath)) {
    throw new Error(`Mapping file not found: ${mappingPath}`);
  }

  const subject = await prisma.subject.findUnique({ where: { slug: 'ks3-maths' } });
  if (!subject) {
    throw new Error('Subject ks3-maths not found. Run db:seed first.');
  }

  const lines = fs
    .readFileSync(mappingPath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let created = 0;
  let updated = 0;

  for (const line of lines) {
    const row = JSON.parse(line) as MappingRow;
    const derived = deriveStoredItemFromMapping(row);
    const issues = getItemContractIssues({
      question: row.question.stem,
      type: derived.type,
      answer: derived.answer,
      options: derived.options,
    });
    const hardIssues = issues.filter((issue) => issue.severity === 'error');
    if (hardIssues.length > 0) {
      throw new Error(
        `Invalid mapped question ${row.source.question_ref}: ${hardIssues.map((issue) => issue.message).join('; ')}`
      );
    }

    const questionText = `[${row.source.question_ref}] ${row.question.stem}`;

    let item = await prisma.item.findFirst({ where: { question: questionText, subjectId: subject.id } });

    if (!item) {
      item = await prisma.item.create({
        data: {
          subjectId: subject.id,
          type: derived.type,
          question: questionText,
          options: derived.options,
          answer: derived.answer,
        },
      });
      created += 1;
    } else {
      item = await prisma.item.update({
        where: { id: item.id },
        data: {
          options: derived.options,
          answer: derived.answer,
          type: derived.type,
        },
      });
      updated += 1;
    }

    const skillCodes = unique([row.skills.primary_skill_code, ...(row.skills.secondary_skill_codes ?? [])]);

    for (const code of skillCodes) {
      const skill = await prisma.skill.findUnique({ where: { subjectId_code: { subjectId: subject.id, code } } });
      if (!skill) continue;

      await prisma.itemSkill.upsert({
        where: { itemId_skillId: { itemId: item.id, skillId: skill.id } },
        update: {},
        create: { itemId: item.id, skillId: skill.id },
      });
    }
  }

  console.log(`✅ Unit1 first25 import complete. Created: ${created}, Updated: ${updated}, Total lines: ${lines.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
