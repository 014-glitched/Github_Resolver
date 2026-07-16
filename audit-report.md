# GitHubResolver Audit Report

Date: 2026-07-16

## ✅ CONFIRMED WORKING

- All requested files exist and are non-empty:
  - app/dashboard/issues/page.tsx
  - app/api/github/issues/route.ts
  - app/api/github/issues/resolve/route.ts
  - app/api/github/connected-repos/route.ts
  - src/lib/functions/resolve-github-issue.ts
  - src/lib/functions/resolve-event.ts
  - src/lib/functions/check-pr-mergeable.ts
  - app/api/inngest/route.ts
  - app/api/github/webhook/route.ts
  - prisma/schema.prisma

- Inngest registration is complete in app/api/inngest/route.ts:
  - resolveGithubEvent
  - checkPrMergeable
  - resolveGithubIssue

- Prisma schema contains the expected issue-resolution models and fields:
  - GithubIssueJob model exists with the requested fields
  - IssueJobStatus enum exists with the requested values
  - GithubEvent includes sourceBranch
  - Repo includes hasCI
  - GithubIssueJob has @@unique([repoId, issueNumber])
  - Repo and User both have issueJobs relations

- The issue-resolution pipeline in src/lib/functions/resolve-github-issue.ts is complete and includes all six required steps:
  - Step 1: mark-analyzing
  - Step 2: fetch-context with a Claude file-picker call plus Octokit calls
  - Step 3: generate-fix with Claude Pass 1
  - Step 4: verify-fix with Claude Pass 2, saving verifyVerdict and verifyNote to the DB
  - Step 5: create-pr using verified.files and including "Closes #issueNumber" in the PR body
  - Step 6: mark-completed

- The issues page in app/dashboard/issues/page.tsx is implemented with the requested UI pieces:
  - fetchRepos calls /api/github/connected-repos
  - TanStack Query is used with refetchInterval: 5000
  - IssueResolveModal supports same, new, and custom branch strategies
  - IssueCard shows progress steps and PR links
  - RepoTabs switches between connected repos

- The API route contracts look correct:
  - GET /api/github/connected-repos returns repos from prisma.repo.findMany with the required fields
  - GET /api/github/issues accepts repoId and merges GitHub issues with GithubIssueJob rows
  - POST /api/github/issues/resolve creates a GithubIssueJob, sends the inngest event, and returns { job } with status 201

- The requested TypeScript checks in src/lib/functions/resolve-github-issue.ts are correct:
  - jobId validation uses if (!jobId || typeof jobId !== "string")
  - retries on inngest.createFunction is 2
  - withRetry is used for Octokit calls only, not for anthropic.messages.create()

- The file is not the old partial version: withRetry is defined and actively used in the Octokit-backed steps.

- The required migrations are present in prisma/migrations/:
  - a migration for GithubIssueJob
  - a migration for sourceBranch on GithubEvent
  - a migration for hasCI on Repo

- Editor diagnostics reported no errors for src/lib/functions/resolve-github-issue.ts.

## ❌ MISSING OR BROKEN

- The sidebar navigation is missing a link to /dashboard/issues in components/app-sidebar.tsx.

## ⚠️ NEEDS ATTENTION

- The issues page implementation is present and working at the code level, but the sidebar navigation gap means the feature is not discoverable from the main app navigation.

## 📋 RECOMMENDED ACTION

1. Add an Issues navigation item to components/app-sidebar.tsx pointing to /dashboard/issues.
2. Optionally verify the issues feature end-to-end in the browser by connecting a repo and triggering a sample issue resolution.
3. If you want to harden the implementation further, add a small integration test around the issue-resolution flow and the API route contracts.
