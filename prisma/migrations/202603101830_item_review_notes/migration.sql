-- CreateEnum
CREATE TYPE "ItemReviewStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ItemReviewCategory" AS ENUM (
    'ANSWER_MODE',
    'ANSWER_MAPPING',
    'STEM_COPY',
    'DISTRACTOR_QUALITY',
    'SKILL_MAPPING',
    'OTHER'
);

-- CreateTable
CREATE TABLE "ItemReviewNote" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "status" "ItemReviewStatus" NOT NULL DEFAULT 'OPEN',
    "category" "ItemReviewCategory" NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ItemReviewNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemReviewNote_itemId_status_createdAt_idx" ON "ItemReviewNote"("itemId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ItemReviewNote_authorUserId_createdAt_idx" ON "ItemReviewNote"("authorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "ItemReviewNote" ADD CONSTRAINT "ItemReviewNote_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemReviewNote" ADD CONSTRAINT "ItemReviewNote_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
