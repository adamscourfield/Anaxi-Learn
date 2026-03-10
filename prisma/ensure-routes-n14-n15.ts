import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type RouteType = 'A' | 'B' | 'C';

const routeMeta: Record<RouteType, { summary: string; worked: string; prompt: string; guided: string }> = {
  A: {
    summary: 'Compare negatives by distance from zero and direction on number line.',
    worked: 'On a number line, values further left are smaller. E.g. -8 < -3.',
    prompt: 'Which is greater: -6 or -2?',
    guided: '-2',
  },
  B: {
    summary: 'Use inequality symbols carefully with negative values.',
    worked: 'When numbers are negative, the greater number is closer to zero.',
    prompt: 'Fill the sign: -4 __ -9',
    guided: '>',
  },
  C: {
    summary: 'Order mixed negatives and zero using a number line mental model.',
    worked: 'Sort left to right: most negative to most positive.',
    prompt: 'Order: -7, 0, -3, 2',
    guided: '-7, -3, 0, 2',
  },
};

const n15Meta: Record<RouteType, { summary: string; worked: string; prompt: string; guided: string }> = {
  A: {
    summary: 'Find median by sorting first, then selecting middle value.',
    worked: 'For 5 values, median is 3rd value after sorting.',
    prompt: 'Median of 9, 1, 5, 3, 7?',
    guided: '5',
  },
  B: {
    summary: 'For even counts, median is mean of two middle values.',
    worked: 'Sort then average two middle values for even set size.',
    prompt: 'Median of 2, 8, 4, 10?',
    guided: '6',
  },
  C: {
    summary: 'Median is robust to outliers but still needs sorted order.',
    worked: 'Sort values first; outliers at ends do not shift middle position directly.',
    prompt: 'Median of 1, 3, 100, 5, 7?',
    guided: '5',
  },
};

async function ensureRoute(skillCode: string, routeType: RouteType, meta: { summary: string; worked: string; prompt: string; guided: string }) {
  const subject = await prisma.subject.findUnique({ where: { slug: 'ks3-maths' } });
  if (!subject) throw new Error('ks3-maths subject missing');

  const skill = await prisma.skill.findUnique({ where: { subjectId_code: { subjectId: subject.id, code: skillCode } } });
  if (!skill) throw new Error(`${skillCode} skill missing`);

  const route = await prisma.explanationRoute.upsert({
    where: { skillId_routeType: { skillId: skill.id, routeType } },
    update: {
      misconceptionSummary: meta.summary,
      workedExample: meta.worked,
      guidedPrompt: meta.prompt,
      guidedAnswer: meta.guided,
      isActive: true,
    },
    create: {
      skillId: skill.id,
      routeType,
      misconceptionSummary: meta.summary,
      workedExample: meta.worked,
      guidedPrompt: meta.prompt,
      guidedAnswer: meta.guided,
      isActive: true,
    },
  });

  const types = await Promise.all([
    prisma.interactionType.upsert({
      where: { key_version: { key: 'place_value_select', version: 'v1' } },
      update: { rendererKey: 'place_value_select' },
      create: { key: 'place_value_select', version: 'v1', rendererKey: 'place_value_select' },
    }),
    prisma.interactionType.upsert({
      where: { key_version: { key: 'compare_columns', version: 'v1' } },
      update: { rendererKey: 'compare_columns' },
      create: { key: 'compare_columns', version: 'v1', rendererKey: 'compare_columns' },
    }),
  ]);

  const stepDefs = [
    {
      stepOrder: 1,
      title: 'Model concept',
      explanation: meta.worked,
      stepType: 'visual_demo',
      question: meta.prompt,
      options: [meta.guided, 'Not sure', 'Cannot tell', 'Other'],
      answer: meta.guided,
      interactionTypeId: types[0].id,
    },
    {
      stepOrder: 2,
      title: 'Guided check',
      explanation: meta.summary,
      stepType: 'guided_action',
      question: meta.prompt,
      options: [meta.guided, 'Not sure', 'Cannot tell', 'Other'],
      answer: meta.guided,
      interactionTypeId: types[1].id,
    },
    {
      stepOrder: 3,
      title: 'Transfer check',
      explanation: 'Apply the same method to a near transfer item.',
      stepType: 'transfer_check',
      question: meta.prompt,
      options: [meta.guided, 'Not sure', 'Cannot tell', 'Other'],
      answer: meta.guided,
      interactionTypeId: types[1].id,
    },
  ];

  for (const def of stepDefs) {
    const step = await prisma.explanationStep.upsert({
      where: { explanationRouteId_stepOrder: { explanationRouteId: route.id, stepOrder: def.stepOrder } },
      update: {
        title: def.title,
        explanation: def.explanation,
        stepType: def.stepType,
        checkpointQuestion: def.question,
        checkpointOptions: { options: def.options, stepType: 'checkpoint' },
        checkpointAnswer: def.answer,
        questionType: 'MCQ',
      },
      create: {
        explanationRouteId: route.id,
        stepOrder: def.stepOrder,
        title: def.title,
        explanation: def.explanation,
        stepType: def.stepType,
        checkpointQuestion: def.question,
        checkpointOptions: { options: def.options, stepType: 'checkpoint' },
        checkpointAnswer: def.answer,
        questionType: 'MCQ',
      },
    });

    await prisma.stepInteraction.upsert({
      where: { explanationStepId_sortOrder: { explanationStepId: step.id, sortOrder: 1 } },
      update: {
        interactionTypeId: def.interactionTypeId,
        config: { mode: skillCode.toLowerCase().replace('.', '-') },
      },
      create: {
        explanationStepId: step.id,
        interactionTypeId: def.interactionTypeId,
        sortOrder: 1,
        config: { mode: skillCode.toLowerCase().replace('.', '-') },
      },
    });
  }
}

async function main() {
  for (const rt of ['A', 'B', 'C'] as const) {
    await ensureRoute('N1.4', rt, routeMeta[rt]);
    await ensureRoute('N1.5', rt, n15Meta[rt]);
  }
  console.log('✅ ensured routes for N1.4 + N1.5 (A/B/C)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
