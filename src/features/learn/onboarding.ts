import { prisma } from '@/db/prisma';

export async function hasCompletedOnboardingDiagnostic(userId: string, subjectId: string): Promise<boolean> {
  const completed = await prisma.diagnosticSession.findFirst({
    where: {
      userId,
      subjectId,
      status: 'COMPLETED',
    },
    select: { id: true },
  });

  return Boolean(completed);
}
