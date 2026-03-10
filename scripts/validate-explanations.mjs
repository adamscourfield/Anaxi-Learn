import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseOptions(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.options)) return raw.options;
  if (raw && Array.isArray(raw.choices)) return raw.choices;
  return [];
}

function norm(v) {
  return String(v ?? '').trim().toLowerCase();
}

async function main() {
  const steps = await prisma.explanationStep.findMany({
    include: { interactions: true, route: { include: { skill: true } } },
  });

  const issues = [];

  for (const step of steps) {
    const id = `${step.route?.skill?.code ?? 'unknown'}:${step.route?.routeType ?? '?'}:step${step.stepOrder}`;

    if (!String(step.questionType ?? '').trim()) {
      issues.push(`${id} missing questionType`);
    }

    if (!String(step.checkpointQuestion ?? '').trim()) {
      issues.push(`${id} missing checkpointQuestion`);
    }

    const options = parseOptions(step.checkpointOptions).map(String).filter((o) => o.trim().length > 0);
    const unique = new Set(options.map(norm));

    if (options.length > 0 && unique.size < options.length) {
      issues.push(`${id} has duplicate checkpoint options`);
    }

    if (options.length > 0 && !unique.has(norm(step.checkpointAnswer))) {
      issues.push(`${id} checkpointAnswer not found in checkpointOptions`);
    }

    if (step.interactions.length === 0) {
      issues.push(`${id} has no stepInteraction`);
    }
  }

  if (issues.length > 0) {
    console.error(`❌ Explanation validation failed (${issues.length} issues):`);
    for (const i of issues.slice(0, 200)) console.error(` - ${i}`);
    process.exit(1);
  }

  console.log(`✅ Explanation validation passed for ${steps.length} steps.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
