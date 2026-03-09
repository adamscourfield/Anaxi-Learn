-- Baseline onboarding phase 1: schema for baseline sessions and attempts

DO $$ BEGIN
  CREATE TYPE "BaselineStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "BaselineSession" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "status" "BaselineStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "itemsSeen" INTEGER NOT NULL DEFAULT 0,
  "maxItems" INTEGER NOT NULL DEFAULT 24,
  "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT "BaselineSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BaselineSession_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "BaselineSession_userId_subjectId_status_idx"
  ON "BaselineSession"("userId", "subjectId", "status");

CREATE TABLE IF NOT EXISTS "BaselineAttempt" (
  "id" TEXT PRIMARY KEY,
  "baselineSessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "correct" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BaselineAttempt_baselineSessionId_fkey" FOREIGN KEY ("baselineSessionId") REFERENCES "BaselineSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BaselineAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BaselineAttempt_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BaselineAttempt_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "BaselineAttempt_baselineSessionId_skillId_idx"
  ON "BaselineAttempt"("baselineSessionId", "skillId");

CREATE UNIQUE INDEX IF NOT EXISTS "BaselineAttempt_baselineSessionId_itemId_key"
  ON "BaselineAttempt"("baselineSessionId", "itemId");
