Wire webhook → trigger Inngest job
⬜ Build AI resolver (Claude API integration)
     → Step 1: Fetch code context from GitHub
     → Step 2: Send to Claude + get patch
     → Step 3: Validate patch
⬜ Auto PR creation
     → Create branch
     → Commit patch
     → Open PR
⬜ Dashboard error feed
     → Show GitHub events in real time
     → Expanded cards with issue details
     → Resolve button per card
⬜ Inline job progress on card
     → Poll job status with TanStack Query
     → Show live steps (fetching → analyzing → patching → PR)
⬜ Activity log page
⬜ Settings page
⬜ Deployment (Vercel + production env vars)

1. Wire webhook → Inngest        ← next right now
2. Dashboard error feed          ← show events live
3. Resolve button → trigger job
4. AI resolver steps
5. Auto PR creation
6. Polish (activity log, settings, deployment)



<!-- Github ISSUES -->
/dashboard/issues
      │
      ├── Tabs per connected repo
      │
      ├── Fetches open issues live via GET /api/github/issues?repoId=xxx
      │         └── Octokit → repo.fullName → octokit.issues.listForRepo()
      │
      ├── Shows each issue: number, title, labels, author, age, status badge
      │
      └── "Resolve with AI" button per issue
                │
                ▼
         Resolve Modal (same one from dashboard)
         same branch / new branch / custom branch
                │
                ▼
         POST /api/github/issues/resolve
         { repoId, issueNumber, issueTitle, issueBody, strategy, customBranch }
                │
                ├── Creates GithubIssueJob in DB (status: QUEUED)
                │
                └── inngest.send("github/issue.resolve", { jobId, ... })
                          │
                          ▼
              resolve-github-issue.ts (new Inngest function)
                          │
                          ├── Step 1: mark ANALYZING
                          │
                          ├── Step 2: fetch context
                          │     ├── get issue body + comments via Octokit
                          │     ├── search repo files mentioned in issue
                          │     └── fetch relevant file contents
                          │
                          ├── Step 3: Claude analyzes
                          │     └── same prompt pattern, but context is
                          │         issue description instead of error logs
                          │
                          ├── Step 4: create branch + commit + PR
                          │     └── PR body includes "Closes #issueNumber"
                          │
                          └── Step 5: mark COMPLETED, save prUrl + prNumber