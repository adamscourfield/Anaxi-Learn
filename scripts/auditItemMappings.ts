import { PrismaClient } from '@prisma/client';
import { getItemContractIssues } from '../src/features/content/questionContract';

const prisma = new PrismaClient();

async function main() {
  const items = await prisma.item.findMany({
    orderBy: { createdAt: 'asc' },
  });

  const problems: string[] = [];

  for (const item of items) {
    const issues = getItemContractIssues(item);
    problems.push(
      ...issues.map((issue) => `${item.id}: [${issue.severity}] ${issue.message} for "${item.question}"`)
    );
  }

  if (problems.length > 0) {
    console.error(`Found ${problems.length} item mapping problem(s):`);
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }

  console.log(`Checked ${items.length} items. No mapping problems found.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
