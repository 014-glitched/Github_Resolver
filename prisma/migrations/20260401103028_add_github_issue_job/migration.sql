-- CreateEnum
CREATE TYPE "IssueJobStatus" AS ENUM ('QUEUED', 'FETCHING_CONTEXT', 'ANALYZING', 'VERIFYING', 'CREATING_PR', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "GithubIssueJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "issueNumber" INTEGER NOT NULL,
    "issueTitle" TEXT NOT NULL,
    "issueBody" TEXT,
    "issueUrl" TEXT,
    "strategy" TEXT NOT NULL DEFAULT 'new',
    "branchName" TEXT,
    "status" "IssueJobStatus" NOT NULL DEFAULT 'QUEUED',
    "prUrl" TEXT,
    "prNumber" INTEGER,
    "errorMsg" TEXT,
    "verifyVerdict" TEXT,
    "verifyNote" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubIssueJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GithubIssueJob_repoId_issueNumber_key" ON "GithubIssueJob"("repoId", "issueNumber");

-- AddForeignKey
ALTER TABLE "GithubIssueJob" ADD CONSTRAINT "GithubIssueJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubIssueJob" ADD CONSTRAINT "GithubIssueJob_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
