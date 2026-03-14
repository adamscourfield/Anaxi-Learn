import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/features/auth/authOptions';
import { prisma } from '@/db/prisma';

interface Props {
  params: Promise<{ sessionId: string }>;
}

export async function GET(_req: NextRequest, { params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== 'TEACHER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const userId = (session.user as { id: string }).id;
  const { sessionId } = await params;

  const liveSession = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: {
      participants: {
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              knowledgeSkillStates: true,
              interventionFlags: {
                where: { isResolved: false },
                select: { id: true, skillId: true, reason: true },
              },
            },
          },
        },
      },
      liveAttempts: {
        select: {
          studentUserId: true,
          skillId: true,
          correct: true,
        },
      },
      skill: { select: { id: true, code: true, name: true } },
    },
  });

  if (!liveSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  if (liveSession.teacherUserId !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Build per-skill response summary
  const skillSummary = new Map<
    string,
    { total: number; answered: Set<string>; correct: number }
  >();

  const participantIds = new Set(liveSession.participants.map((p) => p.studentUserId));

  for (const attempt of liveSession.liveAttempts) {
    const entry = skillSummary.get(attempt.skillId) ?? {
      total: participantIds.size,
      answered: new Set<string>(),
      correct: 0,
    };
    entry.answered.add(attempt.studentUserId);
    if (attempt.correct) entry.correct += 1;
    skillSummary.set(attempt.skillId, entry);
  }

  const responseSummary = Array.from(skillSummary.entries()).map(([skillId, s]) => ({
    skillId,
    totalParticipants: s.total,
    answeredCount: s.answered.size,
    correctCount: s.correct,
  }));

  // Identify skills where students are struggling (for explanation recommendation)
  const skillIds = liveSession.skillId ? [liveSession.skillId] : [];
  let recommendedExplanation = null;

  if (skillIds.length > 0) {
    const explanationPerf = await prisma.explanationPerformance.findMany({
      where: { skillId: { in: skillIds } },
      include: {
        explanation: {
          select: {
            id: true,
            routeType: true,
            misconceptionSummary: true,
            workedExample: true,
          },
        },
      },
      orderBy: { dle: 'desc' },
      take: 1,
    });

    if (explanationPerf.length > 0) {
      const top = explanationPerf[0];
      recommendedExplanation = {
        explanationId: top.explanationId,
        skillId: top.skillId,
        dle: top.dle,
        routeType: top.explanation.routeType,
        misconceptionSummary: top.explanation.misconceptionSummary,
        workedExample: top.explanation.workedExample,
      };
    }
  }

  // Students with open intervention flags
  const studentsWithFlags = liveSession.participants
    .filter((p) => p.student.interventionFlags.length > 0)
    .map((p) => ({
      studentId: p.studentUserId,
      name: p.student.name,
      flags: p.student.interventionFlags,
    }));

  // Build participants with their skill states
  const participants = liveSession.participants.map((p) => {
    const relevantStates = liveSession.skillId
      ? p.student.knowledgeSkillStates.filter((s) => s.skillId === liveSession.skillId)
      : p.student.knowledgeSkillStates;

    return {
      studentId: p.studentUserId,
      name: p.student.name,
      email: p.student.email,
      isActive: p.isActive,
      joinedAt: p.joinedAt,
      skillStates: relevantStates.map((s) => ({
        skillId: s.skillId,
        masteryProbability: s.masteryProbability,
        retrievalStrength: s.retrievalStrength,
        transferAbility: s.transferAbility,
        durabilityBand: s.durabilityBand,
      })),
      hasOpenFlag: p.student.interventionFlags.length > 0,
    };
  });

  return NextResponse.json({
    sessionId: liveSession.id,
    status: liveSession.status,
    joinCode: liveSession.joinCode,
    startedAt: liveSession.startedAt,
    skillId: liveSession.skillId,
    skill: liveSession.skill,
    participants,
    responseSummary,
    recommendedExplanation,
    studentsWithFlags,
  });
}
