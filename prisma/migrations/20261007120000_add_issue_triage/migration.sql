-- CreateEnum
CREATE TYPE "TriageEffort" AS ENUM ('S', 'M', 'L');

-- CreateEnum
CREATE TYPE "TriageRisk" AS ENUM ('low', 'medium', 'high');

-- CreateTable
CREATE TABLE "IssueTriage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "issueNumber" INTEGER NOT NULL,
    "issueUpdatedAt" TIMESTAMP(3) NOT NULL,
    "confidence" INTEGER NOT NULL,
    "effort" "TriageEffort" NOT NULL,
    "risk" "TriageRisk" NOT NULL,
    "reason" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'anthropic',
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueTriage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IssueTriage_repoId_idx" ON "IssueTriage"("repoId");

-- CreateIndex
CREATE INDEX "IssueTriage_repoId_confidence_idx" ON "IssueTriage"("repoId", "confidence");

-- CreateIndex
CREATE UNIQUE INDEX "IssueTriage_repoId_issueNumber_key" ON "IssueTriage"("repoId", "issueNumber");

-- AddForeignKey
ALTER TABLE "IssueTriage" ADD CONSTRAINT "IssueTriage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueTriage" ADD CONSTRAINT "IssueTriage_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
