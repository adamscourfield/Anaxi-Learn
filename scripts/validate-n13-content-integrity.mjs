#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASELINE_PATH = path.resolve(process.cwd(), 'scripts/baselines/n13-label-violations.json');

function hasLabelPrefix(question) {
  if (typeof question !== 'string') return false;

  const codeToken = '[A-Za-z]{1,6}[A-Za-z0-9]*(?:[.:-][A-Za-z0-9]+)*';
  const codeLikeToken = '(?=[A-Za-z0-9.:-]*\\d)[A-Za-z]{1,6}[A-Za-z0-9]*(?:[.:-][A-Za-z0-9]+)*';
  const patterns = [
    new RegExp(`^\\s*\\[${codeToken}\\]\\s*`),
    new RegExp(`^\\s*(?:${codeLikeToken}\\s+){1,3}${codeToken}\\s*[:：\\-–]\\s*`),
    new RegExp(`^\\s*${codeToken}\\s*[:：\\-–]\\s*`),
    new RegExp(`^\\s*${codeLikeToken}\\s+(?:DQ|Q|QUESTION)\\d*\\s*[:：\\-–]?\\s*`, 'i'),
    /^\s*(?:DQ|Q|QUESTION)\s*\d+\s*[:：\-–]\s*/i,
    /^\s*(?:DQ|Q|QUESTION)\s*[:：\-–]\s*/i,
    /^\s*subtopic\s+[A-Za-z0-9.:\-_/]+\s*[:：\-–]?\s*/i,
  ];

  return patterns.some((pattern) => pattern.test(question));
}

function parseChoices(options) {
  if (Array.isArray(options)) return options.filter((o) => typeof o === 'string' && o.trim());
  if (options && typeof options === 'object' && Array.isArray(options.choices)) {
    return options.choices.filter((o) => typeof o === 'string' && o.trim());
  }
  return [];
}

function inferTrueFalse(question, options, answer) {
  const q = typeof question === 'string' ? question.trim() : '';
  const boolQ = /^(correct|incorrect)\s*:/i.test(q) || /^is this statement (correct|true)\??/i.test(q);

  const choices = parseChoices(options).map((c) => c.trim().toLowerCase());
  const set = new Set(choices);
  const boolChoices =
    (set.has('true') && set.has('false')) ||
    (set.has('correct') && set.has('incorrect')) ||
    (set.has('yes') && set.has('no'));

  const a = typeof answer === 'string' ? answer.trim().toLowerCase() : '';
  const boolAnswer = ['true', 'false', 'correct', 'incorrect', 'yes', 'no'].includes(a);

  return boolQ || boolChoices || boolAnswer;
}

function codeAtOrAfter(skillCode, floorCode = 'N1.3') {
  if (typeof skillCode !== 'string') return false;

  const parse = (code) => {
    const m = code.trim().toUpperCase().match(/^([A-Z])(\d+)\.(\d+)$/);
    if (!m) return null;
    return { area: m[1], major: Number(m[2]), minor: Number(m[3]) };
  };

  const left = parse(skillCode);
  const right = parse(floorCode);
  if (!left || !right) return false;
  if (left.area !== right.area) return false;
  if (left.major !== right.major) return left.major > right.major;
  return left.minor >= right.minor;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return new Set();
  try {
    const parsed = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    if (!Array.isArray(parsed?.ids)) return new Set();
    return new Set(parsed.ids.filter((id) => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

function saveBaseline(ids) {
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(
    BASELINE_PATH,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        ids: [...ids].sort(),
      },
      null,
      2
    ) + '\n'
  );
}

async function main() {
  const updateBaseline = process.argv.includes('--update-baseline');

  const rows = await prisma.item.findMany({
    select: {
      id: true,
      question: true,
      type: true,
      options: true,
      answer: true,
      skills: { select: { skill: { select: { code: true } } } },
    },
  });

  const failures = [];
  const labelViolations = new Set();
  let checked = 0;

  for (const item of rows) {
    const skillCodes = item.skills.map((s) => s.skill.code).filter(Boolean);
    const isNewPack = skillCodes.some((code) => codeAtOrAfter(code, 'N1.3'));
    if (!isNewPack) continue;

    checked += 1;

    if (hasLabelPrefix(item.question)) {
      labelViolations.add(item.id);
    }

    const declared = (item.type ?? 'MCQ').trim().toUpperCase();
    if (inferTrueFalse(item.question, item.options, item.answer) && declared !== 'TRUE_FALSE') {
      failures.push(`[${item.id}] inferred TRUE_FALSE but declared type is ${declared}`);
    }
  }

  if (updateBaseline) {
    saveBaseline(labelViolations);
    console.log('🧾 Updated baseline file:', BASELINE_PATH);
    console.log(`- baseline ids: ${labelViolations.size}`);
    console.log(`- n1.3+ items checked: ${checked}`);
    return;
  }

  const baseline = loadBaseline();
  for (const id of labelViolations) {
    if (!baseline.has(id)) {
      failures.push(`[${id}] new label-like prefix found in question text for N1.3+ item`);
    }
  }

  if (failures.length > 0) {
    console.error('❌ N1.3+ content integrity validation failed:');
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }

  console.log('✅ N1.3+ content integrity validation passed');
  console.log(`- n1.3+ items checked: ${checked}`);
  console.log(`- baseline label violations: ${baseline.size}`);
  console.log(`- current label violations: ${labelViolations.size}`);
}

main()
  .catch((err) => {
    console.error('❌ Validation failed with exception:', err?.message ?? err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
