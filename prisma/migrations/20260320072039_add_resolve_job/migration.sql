-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'FETCHING_CONTEXT', 'ANALYZING', 'PATCHING', 'CREATING_PR', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ResolveJob" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "prUrl" TEXT,
    "prNumber" INTEGER,
    "errorMsg" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResolveJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResolveJob_eventId_key" ON "ResolveJob"("eventId");

-- AddForeignKey
ALTER TABLE "ResolveJob" ADD CONSTRAINT "ResolveJob_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GithubEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
