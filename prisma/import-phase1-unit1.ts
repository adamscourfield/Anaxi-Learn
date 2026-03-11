import { Prisma, PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import {
  MappingRow,
  MappingRowSchema,
  deriveStoredItemFromMapping,
  getItemContractIssues,
} from '../src/features/content/questionContract';
import { resolveItemVisuals } from '../src/features/learn/itemVisuals';

const prisma = new PrismaClient();

const PACK_FILES = [
  'docs/unit-mapping/review-pack-phase1-n1-1-to-n1-5.jsonl',
  'docs/unit-mapping/review-pack-phase1-n1-6-to-n1-8.jsonl',
  'docs/unit-mapping/review-pack-phase1-n1-9-to-n1-12.jsonl',
  'docs/unit-mapping/review-pack-phase1-n1-13-to-n1-15.jsonl',
  'docs/unit-mapping/review-pack-phase1-n2-1-to-n2-4.jsonl',
  'docs/unit-mapping/review-pack-phase1-n2-5-to-n2-8.jsonl',
  'docs/unit-mapping/review-pack-phase1-n2-9-to-n2-13.jsonl',
] as const;

const PHASE1_SKILL_META: Record<string, { name: string; strand: string; sortOrder: number }> = {
  'N1.1': { name: 'Recognise the place value of each digit in whole numbers up to millions', strand: 'PV', sortOrder: 5 },
  'N1.2': { name: 'Write integers in words and figures', strand: 'PV', sortOrder: 7 },
  'N1.3': { name: 'Compare two numbers using =, ≠, <, >, ≤, ≥', strand: 'PV', sortOrder: 10 },
  'N1.4': { name: 'Use and interpret inequalities in context (incl number lines and statements)', strand: 'PV', sortOrder: 15 },
  'N1.5': { name: 'Find the median from a set of numbers (incl midpoint using a calculator)', strand: 'STA', sortOrder: 20 },
  'N1.6': { name: 'Decimal place value', strand: 'PV', sortOrder: 30 },
  'N1.7': { name: 'Compare decimals using =, ≠, <, >, ≤, ≥', strand: 'PV', sortOrder: 40 },
  'N1.8': { name: 'Order a list of decimals', strand: 'PV', sortOrder: 50 },
  'N1.9': { name: 'Position integers on a number line', strand: 'PV', sortOrder: 60 },
  'N1.10': { name: 'Rounding to the nearest 10, 100, 1000, integer', strand: 'PV', sortOrder: 70 },
  'N1.11': { name: 'Position decimals on a number line (incl midpoint using a calculator)', strand: 'PV', sortOrder: 80 },
  'N1.12': { name: 'Rounding to decimal places', strand: 'PV', sortOrder: 90 },
  'N1.13': { name: 'Position negatives on a number line', strand: 'PV', sortOrder: 100 },
  'N1.14': { name: 'Compare negatives using =, ≠, <, >, ≤, ≥', strand: 'PV', sortOrder: 110 },
  'N1.15': { name: 'Order any integers, negatives and decimals', strand: 'PV', sortOrder: 120 },
  'N2.1': { name: 'Properties of addition and subtraction', strand: 'ADD', sortOrder: 180 },
  'N2.2': { name: 'Mental strategies for addition and subtraction', strand: 'ADD', sortOrder: 190 },
  'N2.3': { name: 'Use commutative and associative laws', strand: 'LAW', sortOrder: 200 },
  'N2.4': { name: 'Use formal methods for addition of integers', strand: 'ADD', sortOrder: 205 },
  'N2.5': { name: 'Use formal methods for addition of decimals', strand: 'ADD', sortOrder: 210 },
  'N2.6': { name: 'Use formal methods for subtraction of integers', strand: 'ADD', sortOrder: 215 },
  'N2.7': { name: 'Use formal methods for subtraction of decimals; complement of a decimal (1 − p)', strand: 'ADD', sortOrder: 220 },
  'N2.8': { name: 'Money problems involving addition and subtraction', strand: 'ADD', sortOrder: 230 },
  'N2.9': { name: 'Perimeter of irregular polygons', strand: 'PER', sortOrder: 240 },
  'N2.10': { name: 'Perimeter of regular polygons', strand: 'PER', sortOrder: 250 },
  'N2.11': { name: 'Perimeter of rectangles and parallelograms', strand: 'PER', sortOrder: 260 },
  'N2.12': { name: 'Perimeter of an isosceles triangle or an isosceles trapezium', strand: 'PER', sortOrder: 270 },
  'N2.13': { name: 'Perimeter of a compound shape', strand: 'PER', sortOrder: 280 },
};

type Phase1Row = MappingRow & {
  variation?: {
    notes?: string;
  };
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function roleFromNotes(notes: string | undefined): 'anchor' | 'practice' {
  if (typeof notes !== 'string') return 'practice';
  return notes.toUpperCase().includes('ONBOARDING') ? 'anchor' : 'practice';
}

function toSlug(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function parseSlideNumber(questionRef: string): number | null {
  const match = questionRef.match(/^Slide(\d+)/i);
  return match ? Number(match[1]) : null;
}

async function ensureSkill(subjectId: string, code: string) {
  const existing = await prisma.skill.findUnique({
    where: { subjectId_code: { subjectId, code } },
  });
  if (existing) return existing;

  const meta = PHASE1_SKILL_META[code];
  if (!meta) return null;

  return prisma.skill.create({
    data: {
      subjectId,
      code,
      slug: toSlug(code),
      name: meta.name,
      strand: meta.strand,
      sortOrder: meta.sortOrder,
      isStretch: false,
    },
  });
}

async function main() {
  const subject = await prisma.subject.findUnique({ where: { slug: 'ks3-maths' } });
  if (!subject) {
    throw new Error('Subject ks3-maths not found. Run db:seed first.');
  }

  const importedSkillCodes = new Set<string>();
  let created = 0;
  let updated = 0;
  let linked = 0;
  let rowsProcessed = 0;

  for (const relativePath of PACK_FILES) {
    const mappingPath = path.resolve(process.cwd(), relativePath);
    if (!fs.existsSync(mappingPath)) {
      throw new Error(`Mapping file not found: ${mappingPath}`);
    }

    const lines = fs
      .readFileSync(mappingPath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      const raw = JSON.parse(line) as Phase1Row;
      const row = MappingRowSchema.parse(raw);
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
      const slideNumber = parseSlideNumber(row.source.question_ref);
      const visuals = resolveItemVisuals(
        {
          question: row.question.stem,
          options: derived.options,
        },
        row.skills.primary_skill_code
      );
      const options = {
        ...derived.options,
        ...(visuals.length > 0 ? { visuals: visuals as unknown as Prisma.InputJsonValue } : {}),
        meta: {
          question_role: roleFromNotes(raw.variation?.notes),
          source: {
            question_ref: row.source.question_ref,
            source_file: row.source.source_file ?? null,
            slide_number: slideNumber,
          },
        },
      };

      let item = await prisma.item.findFirst({
        where: { question: questionText, subjectId: subject.id },
      });

      if (!item) {
        item = await prisma.item.create({
          data: {
            subjectId: subject.id,
            type: derived.type,
            question: questionText,
            options,
            answer: derived.answer,
          },
        });
        created += 1;
      } else {
        item = await prisma.item.update({
          where: { id: item.id },
          data: {
            type: derived.type,
            options,
            answer: derived.answer,
          },
        });
        updated += 1;
      }

      const skillCodes = unique([row.skills.primary_skill_code, ...(row.skills.secondary_skill_codes ?? [])]);
      for (const code of skillCodes) {
        importedSkillCodes.add(code);
        const skill = await ensureSkill(subject.id, code);
        if (!skill) {
          console.warn(`Skipping missing skill ${code} for ${row.source.question_ref}`);
          continue;
        }

        await prisma.itemSkill.upsert({
          where: { itemId_skillId: { itemId: item.id, skillId: skill.id } },
          update: {},
          create: { itemId: item.id, skillId: skill.id },
        });
        linked += 1;
      }

      rowsProcessed += 1;
    }
  }

  const importedSkills = await prisma.skill.findMany({
    where: {
      subjectId: subject.id,
      code: { in: [...importedSkillCodes] },
    },
    select: { id: true, code: true },
  });

  const placeholderItems = await prisma.item.findMany({
    where: {
      question: { contains: 'Placeholder question', mode: 'insensitive' },
      skills: {
        some: {
          skillId: { in: importedSkills.map((skill) => skill.id) },
        },
      },
    },
    select: { id: true, question: true },
  });

  if (placeholderItems.length > 0) {
    const placeholderIds = placeholderItems.map((item) => item.id);
    await prisma.itemSkill.deleteMany({ where: { itemId: { in: placeholderIds } } });

    for (const item of placeholderItems) {
      await prisma.item.update({
        where: { id: item.id },
        data: {
          subjectId: null,
          question: item.question.startsWith('[ARCHIVED PLACEHOLDER]')
            ? item.question
            : `[ARCHIVED PLACEHOLDER] ${item.question}`,
        },
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        importedPacks: PACK_FILES.length,
        rowsProcessed,
        created,
        updated,
        linked,
        importedSkills: importedSkills.map((skill) => skill.code).sort(),
        placeholdersRemoved: placeholderItems.length,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
