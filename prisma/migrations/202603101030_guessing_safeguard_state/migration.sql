-- Guessing safeguard state (3 rapid wrongs -> half XP for next 5 questions)

CREATE TABLE IF NOT EXISTS "GuessingSafeguardState" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "rapidWrongStreak" INTEGER NOT NULL DEFAULT 0,
  "lastWrongAt" TIMESTAMP(3),
  "penaltyRemaining" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuessingSafeguardState_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
