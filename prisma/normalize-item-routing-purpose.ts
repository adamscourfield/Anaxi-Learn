import { prisma } from '../src/db/prisma';
import { inferItemPurpose } from '../src/features/items/itemPurpose';
import { parseItemOptions } from '../src/features/items/itemMeta';

async function main() {
  const items = await prisma.item.findMany({
    include: {
      skills: {
        include: {
          skill: {
            select: { code: true },
          },
        },
      },
    },
  });

  let updated = 0;
  const purposeCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};

  for (const item of items) {
    const parsed = parseItemOptions(item.options);
    const inferred = inferItemPurpose(item);
    purposeCounts[inferred.purpose] = (purposeCounts[inferred.purpose] ?? 0) + 1;
    typeCounts[inferred.answerType] = (typeCounts[inferred.answerType] ?? 0) + 1;

    const currentMeta = parsed.meta;
    const nextMeta = {
      role: inferred.questionRole,
      route: inferred.route ?? undefined,
      transfer_level:
        inferred.questionRole === 'transfer'
          ? 'medium'
          : currentMeta.transferLevel !== 'none'
            ? currentMeta.transferLevel
            : 'none',
      strictness_level: currentMeta.strictnessLevel,
      misconception_tag: currentMeta.misconceptionTag ?? undefined,
    };

    const nextOptions =
      inferred.answerType === 'MCQ' || inferred.answerType === 'TRUE_FALSE'
        ? {
            choices: inferred.choices,
            meta: nextMeta,
          }
        : {
            choices: [],
            meta: nextMeta,
          };

    const optionsChanged = JSON.stringify(item.options) !== JSON.stringify(nextOptions);
    const typeChanged = item.type !== inferred.answerType;

    if (!optionsChanged && !typeChanged) continue;

    await prisma.item.update({
      where: { id: item.id },
      data: {
        type: inferred.answerType,
        options: nextOptions,
      },
    });
    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        total: items.length,
        updated,
        purposeCounts,
        typeCounts,
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
