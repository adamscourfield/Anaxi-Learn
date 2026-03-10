import { prisma } from '@/db/prisma';
import { emitEvent } from '@/features/telemetry/eventService';
import { grantFor, type RewardEventName } from './rewardEconomy';

export interface UserGamificationSummary {
  xp: number;
  tokens: number;
  streakDays: number;
  activeDaysThisWeek: number;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMonday);
  return d;
}

export async function grantReward(
  userId: string,
  subjectId: string,
  rewardEvent: RewardEventName,
  context: Record<string, unknown> = {}
): Promise<void> {
  const grant = grantFor(rewardEvent);
  const idempotencyKey = typeof context.rewardKey === 'string' ? context.rewardKey : undefined;

  const transactionResult = await prisma.$transaction(async (tx) => {
    if (idempotencyKey) {
      const existing = await tx.rewardTransaction.findUnique({
        where: { idempotencyKey },
        select: { id: true },
      });
      if (existing) {
        return { duplicated: true as const, balance: null };
      }
    }

    await tx.rewardTransaction.create({
      data: {
        userId,
        subjectId,
        eventName: rewardEvent,
        xpDelta: grant.xp,
        tokenDelta: grant.tokens,
        reason: grant.reason,
        idempotencyKey,
        metadata: context,
      },
    });

    const updatedBalance = await tx.studentRewardBalance.upsert({
      where: { userId },
      update: {
        xpTotal: { increment: grant.xp },
        tokenTotal: { increment: grant.tokens },
      },
      create: {
        userId,
        xpTotal: grant.xp,
        tokenTotal: grant.tokens,
      },
      select: { xpTotal: true, tokenTotal: true, streakDays: true },
    });

    return { duplicated: false as const, balance: updatedBalance };
  });

  if (transactionResult.duplicated) return;

  await emitEvent({
    name: 'reward_granted',
    actorUserId: userId,
    studentUserId: userId,
    subjectId,
    payload: {
      rewardEvent,
      xp: grant.xp,
      tokens: grant.tokens,
      reason: grant.reason,
      balanceAfter: {
        xpTotal: transactionResult.balance?.xpTotal ?? grant.xp,
        tokenTotal: transactionResult.balance?.tokenTotal ?? grant.tokens,
      },
      ...context,
    },
  });
}

export async function maybeGrantDailyStreak(
  userId: string,
  subjectId: string,
  now: Date = new Date()
): Promise<boolean> {
  const todayStart = startOfDay(now);

  const todayAlready = await prisma.event.findFirst({
    where: {
      name: 'streak_extended',
      studentUserId: userId,
      createdAt: { gte: todayStart },
    },
    select: { id: true },
  });

  if (todayAlready) return false;

  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const hadYesterday = await prisma.event.findFirst({
    where: {
      name: 'streak_extended',
      studentUserId: userId,
      createdAt: { gte: yesterdayStart, lt: todayStart },
    },
    select: { id: true },
  });

  const balance = await prisma.studentRewardBalance.findUnique({
    where: { userId },
    select: { streakDays: true },
  });

  const previousStreak = balance?.streakDays ?? 0;
  const nextStreak = hadYesterday ? previousStreak + 1 : 1;

  await prisma.studentRewardBalance.upsert({
    where: { userId },
    update: { streakDays: nextStreak },
    create: { userId, streakDays: nextStreak },
  });

  await emitEvent({
    name: 'streak_extended',
    actorUserId: userId,
    studentUserId: userId,
    subjectId,
    payload: {
      streakDays: nextStreak,
      date: todayStart.toISOString().slice(0, 10),
    },
  });

  await grantReward(userId, subjectId, 'streak_day_maintained', {
    streakDays: nextStreak,
    rewardKey: `streak:${userId}:${todayStart.toISOString().slice(0, 10)}`,
  });
  return true;
}

export async function getUserGamificationSummary(userId: string): Promise<UserGamificationSummary> {
  const balance = await prisma.studentRewardBalance.findUnique({
    where: { userId },
    select: { xpTotal: true, tokenTotal: true, streakDays: true },
  });

  const weekStart = startOfWeek(new Date());
  const weeklyEvents = await prisma.event.findMany({
    where: {
      name: 'question_answered',
      studentUserId: userId,
      createdAt: { gte: weekStart },
    },
    select: { createdAt: true },
  });

  const activeDaySet = new Set(weeklyEvents.map((e) => e.createdAt.toISOString().slice(0, 10)));

  return {
    xp: balance?.xpTotal ?? 0,
    tokens: balance?.tokenTotal ?? 0,
    streakDays: balance?.streakDays ?? 0,
    activeDaysThisWeek: activeDaySet.size,
  };
}
