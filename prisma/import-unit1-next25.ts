import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

type MappingRow = {
  source: {
    question_ref: string;
  };
  question: {
    stem: string;
    answer: string;
    options?: string[];
  };
  skills: {
    primary_skill_code: string;
    secondary_skill_codes?: string[];
  };
  marking?: {
    accepted_answers?: string[];
  };
};

const prisma = new PrismaClient();

function normalizeNumber(value: string): number | null {
  const cleaned = value.replace(/,/g, '').trim();
  if (!/^[-+]?\d*\.?\d+$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function numericDistractors(answer: string): string[] {
  const n = normalizeNumber(answer);
  if (n == null) return [];

  const candidates = new Set<string>();
  const abs = Math.abs(n);
  const delta = abs >= 1000 ? 100 : abs >= 100 ? 10 : abs >= 10 ? 1 : 0.1;

  candidates.add(String(n + delta));
  candidates.add(String(Math.max(0, n - delta)));
  candidates.add(String(n + delta * 2));

  return Array.from(candidates)
    .map((v) => (v.includes('.') ? String(Number(v)) : v))
    .filter((v) => v !== answer)
    .slice(0, 3);
}

function optionsForQuestion(stem: string, answer: string): string[] {
  const lcStem = stem.toLowerCase();
  const lcAnswer = answer.toLowerCase();

  if (lcAnswer === 'true' || lcAnswer === 'false') {
    return ['True', 'False'];
  }

  if (lcStem.includes('equivalent to')) {
    return [answer, '1 > 2', '2 < 1', '1 = 2'];
  }

  if (lcStem.includes('at least')) {
    return [answer, '? > 7', '? ≤ 7', '? < 7'];
  }

  const numeric = numericDistractors(answer);
  if (numeric.length >= 3) {
    return [answer, ...numeric.slice(0, 3)];
  }

  return [answer, 'Not sure', 'Cannot be determined', 'None of these'];
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

async function main() {
  const mappingPath = path.resolve(process.cwd(), 'docs/unit-mapping/review-pack-unit1-partA-foundation-next25.jsonl');
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
    const answer = row.marking?.accepted_answers?.[0] ?? row.question.answer;

    // Use explicit options from the JSONL when provided, otherwise auto-generate
    const options = row.question.options && row.question.options.length >= 2
      ? unique(row.question.options)
      : unique(optionsForQuestion(row.question.stem, answer));

    const questionText = `[${row.source.question_ref}] ${row.question.stem}`;

    let item = await prisma.item.findFirst({ where: { question: questionText, subjectId: subject.id } });

    if (!item) {
      item = await prisma.item.create({
        data: {
          subjectId: subject.id,
          type: 'MCQ',
          question: questionText,
          options,
          answer,
        },
      });
      created += 1;
    } else {
      item = await prisma.item.update({
        where: { id: item.id },
        data: {
          options,
          answer,
          type: 'MCQ',
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

  console.log(`✅ Unit1 next25 import complete. Created: ${created}, Updated: ${updated}, Total lines: ${lines.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
