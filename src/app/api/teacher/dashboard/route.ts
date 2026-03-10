import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { prisma } from '@/db/prisma';

function parseDays(input: string | null): number {
  const n = Number(input ?? '30');
  if (![7, 30, 90].includes(n)) return 30;
  return n;
}

const MOMENTUM_DEFINITION =
  'Momentum is a proxy, not a clinical metric. Compare recent vs previous equal windows using efficiency = correctness ÷ time-on-task (minutes), then bucket into Improving / Stable / Declining.';

function getRiskModel(params: { checkpointRate: number; interactionPassRate: number; interventions: number; wrongFirstDiff: number }) {
  const { checkpointRate, interactionPassRate, interventions, wrongFirstDiff } = params;
  let score = 0;
  if (interventions > 0) score += 45;
  if (checkpointRate < 0.5) score += 25;
  else if (checkpointRate < 0.7) score += 15;
  if (interactionPassRate < 0.5) score += 20;
  else if (interactionPassRate < 0.7) score += 10;
  if (wrongFirstDiff >= 3) score += 15;
  else if (wrongFirstDiff > 0) score += 8;

  const riskLevel: 'RED' | 'AMBER' | 'GREEN' = score >= 50 ? 'RED' : score >= 25 ? 'AMBER' : 'GREEN';
  return { riskScore: Math.min(100, score), riskLevel };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = session.user as { id: string; role?: string };
  if (user.role !== 'TEACHER' && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const days = parseDays(req.nextUrl.searchParams.get('days'));
  const subtopic = req.nextUrl.searchParams.get('subtopic')?.trim() || '';
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: user.id },
    include: {
      classrooms: {
        include: {
          classroom: {
            include: {
              enrollments: { select: { studentUserId: true } },
            },
          },
        },
      },
    },
  });

  if (!teacherProfile) return NextResponse.json({ teacherProfile: null, classes: [] });

  const classes = await Promise.all(
    teacherProfile.classrooms.map(async (tc) => {
      const cls = tc.classroom;
      const studentIds = cls.enrollments.map((e) => e.studentUserId);

      const [events, skillStates] = studentIds.length
        ? await Promise.all([
            prisma.event.findMany({
              where: {
                studentUserId: { in: studentIds },
                createdAt: { gte: since },
                ...(subtopic ? { payload: { path: ['subtopicCode'], equals: subtopic } } : {}),
                name: { in: ['step_checkpoint_attempted', 'step_interaction_evaluated', 'intervention_flagged'] },
              },
              select: { name: true, payload: true, studentUserId: true },
            }),
            prisma.studentSkillState.findMany({
              where: { userId: { in: studentIds } },
              select: {
                userId: true,
                latestDle: true,
                latestInstructionalTimeMs: true,
                durabilityBand: true,
              },
            }),
          ])
        : [[], []];

      const stepAttempts = events.filter((e) => e.name === 'step_checkpoint_attempted');
      const interactions = events.filter((e) => e.name === 'step_interaction_evaluated');
      const interventions = events.filter((e) => e.name === 'intervention_flagged');

      const checkpointCorrect = stepAttempts.filter((e) => Boolean((e.payload as Record<string, unknown>).correct)).length;
      const interactionPass = interactions.filter((e) => Boolean((e.payload as Record<string, unknown>).rulePassed)).length;
      const wrongFirstDiff = interactions.filter((e) => (e.payload as Record<string, unknown>).errorType === 'wrong_first_difference').length;
      const checkpointRateValue = stepAttempts.length ? checkpointCorrect / stepAttempts.length : 1;
      const interactionPassValue = interactions.length ? interactionPass / interactions.length : 1;
      const classRisk = getRiskModel({
        checkpointRate: checkpointRateValue,
        interactionPassRate: interactionPassValue,
        interventions: interventions.length,
        wrongFirstDiff,
      });

      const dleValues = skillStates.map((s) => s.latestDle).filter((v): v is number => typeof v === 'number');
      const avgDle = dleValues.length ? dleValues.reduce((sum, v) => sum + v, 0) / dleValues.length : null;
      const atRiskCount = skillStates.filter((s) => s.durabilityBand === 'AT_RISK').length;
      const durableCount = skillStates.filter((s) => s.durabilityBand === 'DURABLE').length;
      const instructionalTimes = skillStates
        .map((s) => s.latestInstructionalTimeMs)
        .filter((v): v is number => typeof v === 'number');
      const avgInstructionalTimeMs = instructionalTimes.length
        ? Math.round(instructionalTimes.reduce((sum, v) => sum + v, 0) / instructionalTimes.length)
        : null;

      return {
        id: cls.id,
        externalClassId: cls.externalClassId,
        name: cls.name,
        yearGroup: cls.yearGroup,
        subjectSlug: cls.subjectSlug,
        students: studentIds.length,
        checkpointAccuracy: stepAttempts.length ? checkpointCorrect / stepAttempts.length : null,
        interactionPassRate: interactions.length ? interactionPass / interactions.length : null,
        interventions: interventions.length,
        wrongFirstDiff,
        riskLevel: classRisk.riskLevel,
        riskScore: classRisk.riskScore,
        avgDle,
        durabilityAtRisk: atRiskCount,
        durabilityDurable: durableCount,
        avgInstructionalTimeMs,
      };
    })
  );

  return NextResponse.json({
    teacherProfile: {
      externalTeacherId: teacherProfile.externalTeacherId,
      externalSchoolId: teacherProfile.externalSchoolId,
      externalSource: teacherProfile.externalSource,
    },
    windowDays: days,
    subtopic: subtopic || null,
    definitions: {
      momentum: MOMENTUM_DEFINITION,
    },
    classes,
  });
}
