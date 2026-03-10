-- CreateEnum
CREATE TYPE "KnowledgeQuestionType" AS ENUM ('ROUTINE', 'FLUENCY', 'RETRIEVAL', 'TRANSFER', 'APPLICATION', 'MIXED', 'DIAGNOSTIC');

-- CreateEnum
CREATE TYPE "SupportLevel" AS ENUM ('INDEPENDENT', 'LIGHT_PROMPT', 'WORKED_EXAMPLE', 'SCAFFOLDED', 'FULL_EXPLANATION');

-- CreateTable
CREATE TABLE "StudentSkillState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "masteryProbability" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
    "forgettingRate" DOUBLE PRECISION NOT NULL DEFAULT 0.12,
    "halfLifeDays" DOUBLE PRECISION NOT NULL DEFAULT 5.776226504666211,
    "retrievalStrength" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "transferAbility" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "lastAttemptAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastReviewAt" TIMESTAMP(3),
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentSkillState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correct" BOOLEAN NOT NULL,
    "responseTimeMs" INTEGER NOT NULL,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "explanationId" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "questionDifficulty" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "questionType" "KnowledgeQuestionType" NOT NULL DEFAULT 'ROUTINE',
    "isTransferItem" BOOLEAN NOT NULL DEFAULT false,
    "isMixedItem" BOOLEAN NOT NULL DEFAULT false,
    "isReviewItem" BOOLEAN NOT NULL DEFAULT false,
    "supportLevel" "SupportLevel" NOT NULL DEFAULT 'INDEPENDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "successScore" DOUBLE PRECISION,
    "daysSinceLastExposure" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExplanationPerformance" (
    "id" TEXT NOT NULL,
    "explanationId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "studentSegment" TEXT NOT NULL DEFAULT 'default',
    "averageLearningGain" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageHalfLifeDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageInstructionTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dle" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExplanationPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentSkillState_userId_skillId_key" ON "StudentSkillState"("userId", "skillId");

-- CreateIndex
CREATE INDEX "StudentSkillState_skillId_idx" ON "StudentSkillState"("skillId");

-- CreateIndex
CREATE INDEX "QuestionAttempt_userId_skillId_occurredAt_idx" ON "QuestionAttempt"("userId", "skillId", "occurredAt");

-- CreateIndex
CREATE INDEX "QuestionAttempt_skillId_occurredAt_idx" ON "QuestionAttempt"("skillId", "occurredAt");

-- CreateIndex
CREATE INDEX "SkillReview_userId_scheduledFor_idx" ON "SkillReview"("userId", "scheduledFor");

-- CreateIndex
CREATE INDEX "SkillReview_userId_skillId_scheduledFor_idx" ON "SkillReview"("userId", "skillId", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "ExplanationPerformance_explanationId_studentSegment_key" ON "ExplanationPerformance"("explanationId", "studentSegment");

-- CreateIndex
CREATE INDEX "ExplanationPerformance_skillId_studentSegment_idx" ON "ExplanationPerformance"("skillId", "studentSegment");

-- AddForeignKey
ALTER TABLE "StudentSkillState" ADD CONSTRAINT "StudentSkillState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentSkillState" ADD CONSTRAINT "StudentSkillState_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_explanationId_fkey" FOREIGN KEY ("explanationId") REFERENCES "ExplanationRoute"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillReview" ADD CONSTRAINT "SkillReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillReview" ADD CONSTRAINT "SkillReview_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExplanationPerformance" ADD CONSTRAINT "ExplanationPerformance_explanationId_fkey" FOREIGN KEY ("explanationId") REFERENCES "ExplanationRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExplanationPerformance" ADD CONSTRAINT "ExplanationPerformance_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
