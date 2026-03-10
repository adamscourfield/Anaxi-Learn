#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseChoices(options) {
  if (Array.isArray(options)) return options.filter((o) => typeof o === 'string' && o.trim().length > 0);
  if (options && typeof options === 'object' && Array.isArray(options.choices)) {
    return options.choices.filter((o) => typeof o === 'string' && o.trim().length > 0);
  }
  return [];
}

function looksLikeTrueFalseQuestion(question) {
  if (typeof question !== 'string') return false;
  const q = question.trim();
  return /^(correct|incorrect)\s*:/i.test(q) || /^is this statement (correct|true)\??/i.test(q);
}

function choicesAreBoolean(choices) {
  if (!Array.isArray(choices) || choices.length < 2) return false;
  const normalized = new Set(choices.map((c) => c.trim().toLowerCase()));
  return (
    (normalized.has('true') && normalized.has('false')) ||
    (normalized.has('correct') && normalized.has('incorrect')) ||
    (normalized.has('yes') && normalized.has('no'))
  );
}

function inferAnswerType({ type, question, options }) {
  if (typeof type === 'string') {
    const normalized = type.trim().toUpperCase();
    if (normalized === 'TRUE_FALSE' || normalized === 'BOOLEAN' || normalized === 'TF') return 'TRUE_FALSE';
    if (normalized === 'SHORT_TEXT' || normalized === 'SHORT') return 'SHORT_TEXT';
    if (normalized === 'SHORT_NUMERIC' || normalized === 'NUMERIC') return 'SHORT_NUMERIC';
  }

  const choices = parseChoices(options);
  if (looksLikeTrueFalseQuestion(question) || choicesAreBoolean(choices)) return 'TRUE_FALSE';
  return 'MCQ';
}

function stripStudentQuestionLabel(question) {
  if (typeof question !== 'string') return '';
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

  let cleaned = question;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.trim();
}

function hasDuplicateChoices(choices) {
  const seen = new Set();
  for (const choice of choices) {
    const key = choice.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function isBooleanAnswer(answer) {
  if (typeof answer !== 'string') return false;
  const normalized = answer.trim().toLowerCase();
  return ['true', 'false', 'correct', 'incorrect', 'yes', 'no'].includes(normalized);
}

function isNumericAnswer(answer) {
  if (typeof answer !== 'string') return false;
  const normalized = answer.trim().replace(/,/g, '');
  return /^-?\d+(\.\d+)?$/.test(normalized);
}

async function main() {
  const applyFixes = process.argv.includes('--fix');
  const problems = [];
  const warnings = [];
  const fixes = [];

  const items = await prisma.item.findMany({
    select: {
      id: true,
      question: true,
      type: true,
      options: true,
      answer: true,
      subject: { select: { slug: true } },
    },
  });

  for (const item of items) {
    const inferred = inferAnswerType(item);
    const declared = (item.type ?? 'MCQ').trim().toUpperCase();
    const choices = parseChoices(item.options);
    const label = `[${item.subject?.slug ?? 'no-subject'}] ${item.id}`;
    const displayQuestion = stripStudentQuestionLabel(item.question);

    if (!displayQuestion) {
      problems.push(`${label} question becomes empty after student-label cleanup`);
    }

    if (displayQuestion !== item.question.trim()) {
      warnings.push(`${label} contains internal label prefixes in question text`);
    }

    if (inferred === 'TRUE_FALSE' && declared !== 'TRUE_FALSE' && declared !== 'BOOLEAN' && declared !== 'TF') {
      const message = `${label} looks TRUE_FALSE but type is ${declared}`;
      if (applyFixes) {
        fixes.push(
          prisma.item.update({ where: { id: item.id }, data: { type: 'TRUE_FALSE' } })
        );
      } else {
        problems.push(message);
      }
    }

    if (declared === 'MCQ' && choices.length < 2) {
      warnings.push(`${label} MCQ has fewer than 2 options`);
    }

    if (hasDuplicateChoices(choices)) {
      problems.push(`${label} has duplicate options`);
    }

    if ((declared === 'MCQ' || inferred === 'TRUE_FALSE') && choices.length > 0) {
      const answerInChoices = choices.some((choice) => choice.trim().toLowerCase() === item.answer.trim().toLowerCase());
      if (!answerInChoices && !choices.some((choice) => inferAnswerType({ type: item.type, question: item.question, options: item.options }) === 'TRUE_FALSE' && isBooleanAnswer(choice) && isBooleanAnswer(item.answer))) {
        problems.push(`${label} correct answer is not present in choices`);
      }
    }

    if ((declared === 'TRUE_FALSE' || inferred === 'TRUE_FALSE') && !isBooleanAnswer(item.answer)) {
      problems.push(`${label} TRUE_FALSE item has non-boolean answer: "${item.answer}"`);
    }

    if ((declared === 'SHORT_NUMERIC' || declared === 'NUMERIC') && !isNumericAnswer(item.answer)) {
      problems.push(`${label} SHORT_NUMERIC item has non-numeric answer: "${item.answer}"`);
    }
  }

  if (applyFixes && fixes.length > 0) {
    await prisma.$transaction(fixes);
    console.log(`🛠️ Applied ${fixes.length} type fix(es) to TRUE_FALSE items`);
  }

  if (warnings.length > 0) {
    console.warn('⚠️ Warnings:');
    for (const w of warnings) console.warn(`- ${w}`);
  }

  if (problems.length > 0) {
    console.error('❌ Item answer-type validation failed:');
    for (const p of problems) console.error(`- ${p}`);
    console.error('\nTip: run with --fix to auto-convert obvious TRUE_FALSE type mismatches.');
    process.exit(1);
  }

  console.log('✅ Item answer-type validation passed');
  console.log(`- items checked: ${items.length}`);
  if (!applyFixes) console.log('- auto-fix available: node scripts/validate-item-answer-types.mjs --fix');
}

main()
  .catch((err) => {
    console.error('❌ Validation failed with exception:', err?.message ?? err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
