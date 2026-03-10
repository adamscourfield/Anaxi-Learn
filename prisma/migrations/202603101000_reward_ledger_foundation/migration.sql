-- Reward ledger foundation: durable balances + transaction log

CREATE TABLE IF NOT EXISTS "StudentRewardBalance" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "xpTotal" INTEGER NOT NULL DEFAULT 0,
  "tokenTotal" INTEGER NOT NULL DEFAULT 0,
  "streakDays" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentRewardBalance_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "RewardTransaction" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "subjectId" TEXT,
  "eventName" TEXT NOT NULL,
  "xpDelta" INTEGER NOT NULL,
  "tokenDelta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "idempotencyKey" TEXT UNIQUE,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RewardTransaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RewardTransaction_subjectId_fkey"
    FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "RewardTransaction_userId_createdAt_idx"
  ON "RewardTransaction"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "RewardTransaction_eventName_createdAt_idx"
  ON "RewardTransaction"("eventName", "createdAt");

-- One-time backfill from reward_granted events so existing users keep their totals.
INSERT INTO "StudentRewardBalance" ("id", "userId", "xpTotal", "tokenTotal", "streakDays", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text),
  e."studentUserId",
  COALESCE(SUM(((e."payload"->>'xp')::numeric)), 0)::int,
  COALESCE(SUM(((e."payload"->>'tokens')::numeric)), 0)::int,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Event" e
WHERE e."name" = 'reward_granted'
  AND e."studentUserId" IS NOT NULL
GROUP BY e."studentUserId"
ON CONFLICT ("userId") DO NOTHING;
