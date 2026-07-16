app/api/inngest/route.ts
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [resolveGithubEvent],
});
```

This does two things:
- **Registration** — when Inngest dev server starts, it hits this route to discover what functions exist in your app
- **Execution** — when an Inngest job needs to run a step, it sends a POST to this route

Without this route, Inngest has no way to know your functions exist or trigger them.

---

### 3. `src/lib/functions/resolve-event.ts`
**Purpose:** The actual background job that resolves a GitHub issue end to end.

This is the heart of the whole product. It's an Inngest function with 5 steps:
```
inngest.createFunction(
  config,           ← function settings (id, name, retries, onFailure)
  trigger,          ← what event starts this function
  handler           ← the actual job logic with steps
)

{ event: "github/event.resolve" }
```
This function runs whenever someone calls `inngest.send({ name: "github/event.resolve" })` — which happens in `app/api/github/resolve/route.ts` when the user clicks Resolve.

---

### The 5 Steps Inside resolve-event.ts

**Why steps at all?**
Each `step.run()` is independently retried if it fails. Without steps, if Claude API times out on step 3, Inngest retries the whole job from scratch including re-fetching GitHub files. With steps, only the failed step retries.
```
Step 1: mark-resolving
```
- Validates `eventId` exists and isn't already resolved
- Updates `GithubEvent.status` → `RESOLVING`
- Updates `ResolveJob.status` → `FETCHING_CONTEXT`
- Purpose: immediately shows the user "this is being worked on"
```
Step 2: fetch-context
```
- Fetches the event from DB including repo + user + GitHub access token
- Calls GitHub API to get the actual file contents that changed
- Handles 3 event types differently:
  - `CI_FAILURE` → gets files from the commit SHA that failed
  - `PR_CONFLICT` → gets files from the PR's changed files
  - `CODE_ERROR` → gets files from the push commit
- Returns `{ files, errorContext, repoFullName, accessToken }`
- Purpose: give Claude everything it needs to understand the problem
```
Step 3: analyze-with-claude
```
- Takes the files + error context from Step 2
- Builds a structured prompt with strict rules
- Sends to `claude-sonnet-4` via Anthropic SDK
- Parses and validates the JSON response
- Returns `{ explanation, files (fixed), commitMessage }`
- Purpose: the AI brain — figures out what's wrong and how to fix it
```
Step 4: create-pr
```
- Creates a new branch `fix/auto-{eventId}`
- Commits each fixed file to that branch
- Checks if a PR already exists (idempotent — safe to retry)
- Opens a PR with a structured body showing what was fixed
- Returns `{ prUrl, prNumber, branchName }`
- Purpose: puts the fix into GitHub as a real PR the developer can review
```
Step 5: mark-resolved
```
- Updates `GithubEvent.status` → `RESOLVED`
- Updates `ResolveJob` with `status: COMPLETED`, `prUrl`, `prNumber`, `completedAt`
- Purpose: tells the dashboard the job is done and shows the PR link

---

### 4. `app/api/github/resolve/route.ts`
**Purpose:** The API endpoint the dashboard calls when the user clicks Resolve.
```
User clicks Resolve
      ↓
POST /api/github/resolve
  → Validates session
  → Verifies event belongs to user
  → Creates ResolveJob in DB (status: QUEUED)
  → Calls inngest.send("github/event.resolve")
      ↓
Inngest queues the job
      ↓
resolve-event.ts runs in background
```

---

### 5. `app/api/github/reset-event/route.ts`
**Purpose:** Resets a stuck or failed event back to `PENDING` so the user can retry.

Added because jobs were getting stuck at `RESOLVING` with no recovery path — either due to Inngest not running or a mid-job failure without proper error handling.

---

### How Everything Connects
```
User clicks Resolve on dashboard
        ↓
POST /api/github/resolve
  → Creates ResolveJob (QUEUED)
  → inngest.send("github/event.resolve", { eventId })
        ↓
Inngest receives event
  → Finds resolveGithubEvent function registered at /api/inngest
  → Starts executing steps one by one
        ↓
Step 1: mark-resolving    → DB: event=RESOLVING, job=FETCHING_CONTEXT
Step 2: fetch-context     → GitHub API: get changed files
Step 3: analyze-with-claude → Anthropic API: get patch
Step 4: create-pr         → GitHub API: branch + commit + PR
Step 5: mark-resolved     → DB: event=RESOLVED, job=COMPLETED
        ↓
Dashboard polls /api/github/events every 4 seconds
  → TanStack Query refetches
  → UI updates to show PR link



  <!-- GITHUB ISSUES INNGEST WORKING -->
  Step 1 — mark-analyzing
  └── Update GithubIssueJob status to ANALYZING in DB

Step 2 — fetch-context
  └── Use Octokit to:
      ├── Get issue title + body + all comments
      ├── Extract file/function names mentioned in the issue
      ├── Search repo file tree for relevant files
      └── Fetch content of those files (max 5, same limit as now)

Step 3 — generate-fix  (Pass 1)
  └── Send to Claude:
      ├── Issue title + body + comments
      ├── Relevant file contents
      └── Instruction: produce a minimal fix + commit message
  └── Returns: { files[], commitMessage, explanation }

Step 4 — verify-fix   (Pass 2 — self-critique)
  └── Send to Claude (separate API call):
      ├── Original issue description
      ├── Original file contents (before fix)
      ├── Proposed fix (files[] from Step 3)
      └── Instruction: review the fix, find any problems,
          return either APPROVED or REVISED with corrected files
  └── Returns: { verdict: "approved" | "revised", files[], explanation }
  └── If revised → uses corrected files in Step 5
  └── If approved → uses original files from Step 3

Step 5 — create-pr
  └── Same as resolve-github-event:
      ├── Create branch (based on strategy)
      ├── Commit all files
      └── Create PR with body containing "Closes #issueNumber"
          + explanation from Step 3
          + verification note from Step 4

Step 6 — mark-completed
  └── Update GithubIssueJob:
      ├── status: COMPLETED
      ├── prUrl, prNumber
      └── completedAts