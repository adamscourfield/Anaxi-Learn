import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function hasChoices(options: any): boolean {
  if (Array.isArray(options)) return options.length > 1;
  if (options && Array.isArray(options.options)) return options.options.length > 1;
  if (options && Array.isArray(options.choices)) return options.choices.length > 1;
  return false;
}

async function main() {
  const steps = await prisma.explanationStep.findMany({
    where: {
      OR: [{ questionType: null as any }, { questionType: '' }],
    },
    select: { id: true, checkpointOptions: true, checkpointAnswer: true },
  });

  let updated = 0;

  for (const step of steps) {
    const qType = hasChoices(step.checkpointOptions) ? 'MCQ' : 'SHORT';
    await prisma.explanationStep.update({ where: { id: step.id }, data: { questionType: qType } });
    updated += 1;
  }

  console.log(`✅ Normalized explanation step question types. Updated: ${updated}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
