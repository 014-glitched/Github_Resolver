-- CreateEnum
CREATE TYPE "PrOutcomeState" AS ENUM ('OPEN', 'MERGED', 'CLOSED_UNMERGED', 'CHANGES_REQUESTED');

-- CreateTable
CREATE TABLE "PrOutcome" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "issueNumber" INTEGER NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "prUrl" TEXT NOT NULL,
    "state" "PrOutcomeState" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3),
    "mergedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "changesRequestedAt" TIMESTAMP(3),
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "githubUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "action" TEXT,
    "repoId" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrOutcome_jobId_key" ON "PrOutcome"("jobId");

-- CreateIndex
CREATE INDEX "PrOutcome_repoId_idx" ON "PrOutcome"("repoId");

-- CreateIndex
CREATE INDEX "PrOutcome_state_idx" ON "PrOutcome"("state");

-- CreateIndex
CREATE UNIQUE INDEX "PrOutcome_repoId_prNumber_key" ON "PrOutcome"("repoId", "prNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_deliveryId_key" ON "WebhookDelivery"("deliveryId");

-- AddForeignKey
ALTER TABLE "PrOutcome" ADD CONSTRAINT "PrOutcome_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrOutcome" ADD CONSTRAINT "PrOutcome_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrOutcome" ADD CONSTRAINT "PrOutcome_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GithubIssueJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill OPEN outcomes for existing completed AI PRs
INSERT INTO "PrOutcome" (
  "id",
  "userId",
  "repoId",
  "jobId",
  "issueNumber",
  "prNumber",
  "prUrl",
  "state",
  "openedAt",
  "lastObservedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'backfill_' || j."id",
  j."userId",
  j."repoId",
  j."id",
  j."issueNumber",
  j."prNumber",
  j."prUrl",
  'OPEN'::"PrOutcomeState",
  COALESCE(j."completedAt", j."createdAt"),
  COALESCE(j."completedAt", j."createdAt"),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "GithubIssueJob" j
WHERE j."status" = 'COMPLETED'
  AND j."prNumber" IS NOT NULL
  AND j."prUrl" IS NOT NULL
ON CONFLICT ("jobId") DO NOTHING;
