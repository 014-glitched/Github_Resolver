# GitHubResolver — Complete Project Documentation

## Project Overview

GitHubResolver is an AI-powered application that connects to a user's GitHub account, detects errors in Pull Requests (merge conflicts, CI failures, code errors), and automatically resolves them by generating a fix and opening a new PR — all via a background job powered by Claude AI.

---

## Final Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 14 (App Router) | UI, routing, server components |
| Data Fetching | TanStack Query | Caching, polling, optimistic updates |
| Styling | Tailwind CSS + shadcn/ui | Utility-first styling + components |
| Auth | Better Auth | GitHub OAuth, session management |
| ORM | Prisma ORM | Type-safe database queries |
| Database | PostgreSQL via Neon | Primary database |
| Background Jobs | Inngest | AI resolution job queue + step functions |
| AI | Anthropic SDK (claude-sonnet-4) | Bug analysis and patch generation |
| GitHub API | Octokit SDK | Webhooks, branches, PRs |
| Tunnel (dev) | Cloudflare Tunnel | Expose localhost for GitHub webhooks |
| Deployment | Vercel + Neon | Production infrastructure |

> ⚠️ **Stack change from original plan:** BullMQ + Redis (Upstash) was replaced with **Inngest** for background jobs. Inngest requires zero infra setup, has a built-in dev dashboard, supports step functions with independent retries per step, and is far easier to debug locally.

---

## Why This Stack?

### Next.js over Microservices
Microservices add infra overhead (Docker, inter-service auth, multiple repos) before shipping v1. Next.js keeps everything in one repo with shared TypeScript types, one deploy, and zero CORS issues.

### TanStack Query
Not an alternative to Next.js — it works alongside it. Handles client-side caching, polling for job progress every 4 seconds, and optimistic updates. Critical for the live inline job progress on the dashboard.

### Prisma over Supabase client
Prisma gives cleaner, fully type-safe queries and keeps the GitHub access token directly in your own `User` table — critical for this project since the token is the core of the product.

### Neon over Supabase DB
No DB pausing on free tier, built-in connection pooling for serverless, and DB branching (like git branches for your database).

### Better Auth over NextAuth
Simpler setup, better Next.js App Router support, and GitHub access tokens stored cleanly in your own schema via Prisma adapter.

### Inngest over BullMQ + Redis
- Zero infra — no Redis server needed
- Built-in dev dashboard at `http://localhost:8288`
- Step functions — each step retried independently on failure
- Event streaming visible in real time
- Free tier is generous for MVP

---

## Project Structure

```
github-resolver/
├── prisma/
│   ├── schema.prisma              # Database schema
│   ├── prisma.config.ts           # Prisma configuration
│   └── migrations/                # Migration history
├── src/
│   ├── lib/
│   │   ├── prisma.ts              # Prisma client singleton
│   │   ├── auth.ts                # Better Auth server config
│   │   ├── auth-client.ts         # Better Auth client config
│   │   └── functions/
│   │       ├── resolve-event.ts       # AI resolver background job
│   │       └── check-pr-mergeable.ts  # PR conflict detection via polling
│   ├── inngest/
│   │   └── client.ts              # Inngest client
│   └── providers/
│       └── query-provider.tsx     # TanStack Query provider
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...all]/
│   │   │       └── route.ts       # Better Auth handler
│   │   ├── inngest/
│   │   │   └── route.ts           # Inngest handler (registers all functions)
│   │   ├── settings/
│   │   │   ├── profile/route.ts       # Fetch user profile + repos
│   │   │   ├── disconnect-all/route.ts # Disconnect all repos
│   │   │   └── delete-account/route.ts # Delete account
│   │   └── github/
│   │       ├── repos/route.ts         # Fetch GitHub repos
│   │       ├── connect/route.ts       # Connect repo + register webhook + detect CI
│   │       ├── disconnect/route.ts    # Disconnect repo + delete webhook
│   │       ├── refresh-ci/route.ts    # Refresh hasCI flag for a repo
│   │       ├── webhook/route.ts       # Receive GitHub webhook events
│   │       ├── events/route.ts        # Fetch events from DB
│   │       ├── activity/route.ts      # Fetch paginated activity history
│   │       ├── resolve/route.ts       # Trigger Inngest resolve job
│   │       └── reset-event/route.ts   # Reset stuck/failed event
│   ├── dashboard/
│   │   ├── layout.tsx             # Protected layout with sidebar
│   │   ├── page.tsx               # Dashboard + error feed
│   │   ├── repositories/
│   │   │   └── page.tsx           # Repositories management
│   │   ├── activity/
│   │   │   └── page.tsx           # Activity log with timeline + stats
│   │   └── settings/
│   │       └── page.tsx           # Account + repo settings
│   ├── login/
│   │   └── page.tsx               # GitHub OAuth login
│   └── layout.tsx                 # Root layout with QueryProvider
├── components/
│   ├── ui/                        # shadcn components
│   ├── app-sidebar.tsx            # Sidebar component
│   ├── empty-state.tsx            # Reusable empty state component
│   ├── page-header.tsx            # Reusable page header component
│   └── section-card.tsx           # Reusable section card component
├── middleware.ts                  # Route protection
├── scripts/
│   └── seed-event.ts              # Dev seed script
├── .env                           # Environment variables
└── package.json
```

---

## Environment Variables

```env
# Neon PostgreSQL
DATABASE_URL="postgresql://USER:PASSWORD@HOST/dbname?sslmode=require"

# Better Auth
BETTER_AUTH_SECRET="your-random-secret"
BETTER_AUTH_URL="https://your-cloudflare-tunnel-url.trycloudflare.com"

# GitHub OAuth App
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# GitHub Webhook
GITHUB_WEBHOOK_SECRET="your-webhook-secret"

# Anthropic
ANTHROPIC_API_KEY="sk-ant-your-key"

# Inngest
INNGEST_DEV=1
```

> ⚠️ `BETTER_AUTH_URL` must point to your Cloudflare tunnel URL during local development so GitHub webhooks can reach your local server. Update this every time your tunnel URL changes.

---

## NPM Scripts

```json
"scripts": {
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "inngest": "npx inngest-cli@latest dev -u http://localhost:3000/api/inngest",
  "tunnel": "npx cloudflared tunnel --url http://localhost:3000"
}
```

**Every dev session requires 3 terminals:**
```
Terminal 1 → npm run dev       (Next.js app)
Terminal 2 → npm run inngest   (Inngest dev server)
Terminal 3 → npm run tunnel    (Cloudflare tunnel for webhooks)
```

---

## Dependencies

```bash
# Core
npm install prisma @prisma/client @prisma/adapter-pg pg
npm install better-auth
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install octokit
npm install inngest
npm install @anthropic-ai/sdk
npm install dotenv

# UI
npm install tailwindcss-animate class-variance-authority clsx tailwind-merge lucide-react
npx shadcn@latest init
npx shadcn@latest add sidebar button badge avatar separator dialog input tooltip tabs skeleton card

# Dev
npm install -D prisma tsx @types/pg
```

---

## Prisma Schema (Current)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

model User {
  id            String        @id
  name          String
  email         String
  emailVerified Boolean       @default(false)
  image         String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  sessions      Session[]
  accounts      Account[]
  repos         Repo[]
  githubEvents  GithubEvent[]
  @@unique([email])
  @@map("user")
}

model Session {
  id        String   @id
  expiresAt DateTime
  token     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([token])
  @@index([userId])
  @@map("session")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  @@index([userId])
  @@map("account")
}

model Verification {
  id         String    @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime?
  updatedAt  DateTime?
  @@index([identifier])
  @@map("verification")
}

model Repo {
  id        String        @id @default(cuid())
  userId    String
  githubId  Int           @unique
  name      String
  fullName  String
  private   Boolean       @default(false)
  webhookId Int?
  hasCI     Boolean       @default(false)   -- whether repo has GitHub Actions configured
  createdAt DateTime      @default(now())
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  events    GithubEvent[]
}

model GithubEvent {
  id           String      @id @default(cuid())
  userId       String
  repoId       String
  type         EventType
  title        String
  description  String?
  sourceBranch String?     -- branch the error originated from
  payload      Json
  status       EventStatus @default(PENDING)
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  user         User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  repo         Repo        @relation(fields: [repoId], references: [id], onDelete: Cascade)
  resolveJob   ResolveJob?
}

model ResolveJob {
  id          String    @id @default(cuid())
  eventId     String    @unique
  status      JobStatus @default(QUEUED)
  prUrl       String?
  prNumber    Int?
  errorMsg    String?
  startedAt   DateTime?
  completedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  event       GithubEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
}

enum EventType {
  PR_CONFLICT
  CI_FAILURE
  MERGE_ERROR
  CODE_ERROR
  PR_REVIEW_REQUESTED
}

enum EventStatus {
  PENDING
  RESOLVING
  RESOLVED
  FAILED
  IGNORED
}

enum JobStatus {
  QUEUED
  FETCHING_CONTEXT
  ANALYZING
  PATCHING
  CREATING_PR
  COMPLETED
  FAILED
  CANCELLED
}
```

### Migrations run
```
20260316055503_init
20260320072039_add_resolve_job
add_source_branch_to_github_event
add_has_ci_to_repo
```

---

## API Routes

| Method | Route | Purpose | Auth |
|---|---|---|---|
| GET/POST | `/api/auth/[...all]` | Better Auth handler | Public |
| GET/POST/PUT | `/api/inngest` | Inngest handler | Public |
| GET | `/api/github/repos` | Fetch user GitHub repos | Session |
| POST | `/api/github/connect` | Connect repo + register webhook + detect CI | Session |
| POST | `/api/github/disconnect` | Disconnect repo + delete webhook | Session |
| POST | `/api/github/refresh-ci` | Refresh hasCI flag for a repo | Session |
| POST | `/api/github/webhook` | Receive GitHub events | Webhook signature |
| GET | `/api/github/events` | Fetch events from DB (dashboard) | Session |
| GET | `/api/github/activity` | Fetch paginated activity with stats | Session |
| POST | `/api/github/resolve` | Trigger Inngest resolve job | Session |
| POST | `/api/github/reset-event` | Reset stuck/failed event | Session |
| GET | `/api/settings/profile` | Fetch user profile + repos + accounts | Session |
| POST | `/api/settings/disconnect-all` | Disconnect all repos + delete webhooks | Session |
| DELETE | `/api/settings/delete-account` | Delete account + all data | Session |

---

## Inngest Functions

### 1. `resolve-event.ts` — AI Resolver

Triggered manually when user clicks "Resolve issue" on the dashboard.

```
Step 1: mark-resolving
  → Validates eventId
  → Checks event exists and isn't already resolved
  → Updates event status to RESOLVING
  → Updates ResolveJob status to FETCHING_CONTEXT

Step 2: fetch-context
  → Fetches event + repo + user from DB
  → Gets GitHub access token from Account table
  → Fetches changed files from GitHub API based on event type:
      CI_FAILURE  → files from commit SHA
      PR_CONFLICT → files from PR
      CODE_ERROR  → files from push commits
  → Returns files + errorContext + repoFullName + accessToken

Step 3: analyze-with-claude
  → Updates ResolveJob status to ANALYZING
  → Builds structured prompt with issue context + file contents
  → Sends to claude-sonnet-4 via Anthropic SDK
  → Parses and validates JSON response
  → Returns explanation + fixed files + commitMessage

Step 4: create-pr
  → Updates ResolveJob status to CREATING_PR
  → Determines branch strategy from event.data:
      "same"   → commits to sourceBranch from DB
      "custom" → commits to user-provided branch name
      "new"    → creates fix/auto-{eventId} branch (default)
  → Only creates new branch for "new" and "custom" strategies
  → Commits each fixed file (idempotent — handles existing file SHA)
  → Checks for existing open PR to prevent duplicates
  → Opens PR with structured body including issue context + explanation
  → Returns prUrl + prNumber

Step 5: mark-resolved
  → Updates event status to RESOLVED
  → Updates ResolveJob status to COMPLETED with prUrl + prNumber
```

**Resilience features:**
- `withRetry()` wrapper on all GitHub API calls — handles rate limits (429) and transient errors (500/502/503)
- Idempotent branch creation — 422 "already exists" handled gracefully
- Duplicate PR prevention — checks open PRs before creating
- Input validation before any DB call
- Already-resolved check prevents re-processing
- Detailed error logging for skipped files
- `onFailure` handler updates event + job to FAILED with error message

---

### 2. `check-pr-mergeable.ts` — PR Conflict Detection

Triggered by the webhook when a `pull_request` event fires. Uses exponential backoff + jitter to poll GitHub until the mergeable status resolves.

**Why polling?** GitHub computes `mergeable` asynchronously — the field is `null` when the webhook first fires. Direct `mergeable === false` checks in the webhook almost never work.

```
Step 1: wait-attempt-0
  → Sleeps for ~10s + random jitter (0–5s)

Step 2: fetch-mergeable-attempt-0
  → Calls GitHub API GET /repos/{owner}/{repo}/pulls/{number}
  → Returns pr.mergeable (true | false | null)
  → If not null → exits loop with definitive answer

Step 3: wait-attempt-1 (if still null)
  → Sleeps for ~25s + random jitter (0–8s)

Step 4: fetch-mergeable-attempt-1
  → Polls again

Step 5: wait-attempt-2 (if still null)
  → Sleeps for ~45s + random jitter (0–10s)

Step 6: fetch-mergeable-attempt-2
  → Final poll — gives up if still null

Decision:
  → null after 3 attempts → skip, log warning
  → true → skip, PR is mergeable
  → false → create or reset PR_CONFLICT event in DB
```

**Jitter strategy:** Decorrelated jitter prevents thundering herd when multiple PRs open simultaneously. All jobs spread out naturally instead of hammering the GitHub API at the same time.

**Max wait time:** ~98 seconds worst case before giving up.

---

## Webhook Flow (Updated)

```
GitHub repo event (push / pull_request / check_run)
        ↓
POST /api/github/webhook
  → Verify HMAC SHA-256 signature
  → Find repo in DB — ignore unknown repos
        ↓
  [pull_request event]
  → Send to Inngest: github/pr.check-mergeable
  → Return immediately (polling handles the rest)
        ↓
  [check_run / push event]
  → parseGithubEvent()
      check_run + conclusion:failure → CI_FAILURE
      push (no CI) + error pattern   → CODE_ERROR
      push (has CI)                  → ignored (CI_FAILURE handles it)
      fix/auto-* branch push         → always ignored
  → Scenario 1: if resolved event exists for same branch → reset to PENDING
  → Deduplication: skip if same type PENDING/RESOLVING within 10 min
  → Create new GithubEvent in DB
        ↓
User clicks "Resolve issue" on dashboard
  → POST /api/github/resolve
  → Upsert ResolveJob as QUEUED
  → inngest.send("github/event.resolve", { eventId, strategy, customBranch })
        ↓
Inngest runs resolve-event.ts step functions
        ↓
Dashboard polls /api/github/events every 4s
  → TanStack Query updates UI in real time
```

---

## Dashboard Features

### Resolve Modal
When user clicks "Resolve issue" a modal appears with three branch strategy options:

| Option | Description |
|---|---|
| Fix in same branch | Commits directly to `sourceBranch` saved in DB |
| Create new branch | Creates `fix/auto-{eventId}` — shown as preview |
| Custom branch name | User types their own branch name |

A **Skip** button at the bottom auto-selects "new branch" strategy. Hovering shows tooltip: "A new branch will be created automatically."

### Event Card States
| State | Dot color | Border | Actions |
|---|---|---|---|
| PENDING | Red/Yellow/Blue | Default | Resolve issue button |
| RESOLVING | Primary | Default | Resolving... + Cancel |
| RESOLVED | Green | Green | Fix ready + PR link + Resolved badge |
| FAILED | Red | Red | Failed message + Retry |

### Stat Cards
- **Open issues** — events with PENDING state
- **Resolved** — events with RESOLVED state
- **PRs created** — events with a prUrl

---

## Settings Page Features

### Profile Tab
- GitHub avatar, name, email, member since date
- Workspace summary — connected repos count, granted scopes count, GitHub accounts count
- OAuth scopes display

### Repositories Tab
- List of connected repos with webhook status, connected date, CI badge ("CI detected" / "No CI")
- **Refresh CI** button — re-checks `.github/workflows` on GitHub and updates `hasCI` flag
- **Disconnect** button per repo
- Link to full repository manager

### Danger Zone Tab
- **Disconnect all repositories** — removes all webhooks, preserves event history
- **Delete account** — permanently deletes account, repos, webhooks, and all event history

---

## Activity Log Features

- Full paginated event history (50 per page)
- Filter by status: ALL / RESOLVED / FAILED / PENDING / RESOLVING
- Search by title or repository
- Grouped by date: Today / Yesterday / This Week / Older
- Stats: total events, resolved, failed, success rate, most active repo
- Click any event to open detail modal showing job timeline, PR link, error details

---

## CI Detection

When a repo is connected, the app checks GitHub API for `.github/workflows/` directory:

```ts
GET /repos/{owner}/{repo}/contents/.github/workflows
```

- If directory exists and has files → `hasCI = true`
- If not found or empty → `hasCI = false`

This flag is stored on the `Repo` model and used in the webhook to decide event detection strategy:
- `hasCI = true` → skip push regex, wait for `CI_FAILURE` from `check_run`
- `hasCI = false` → use commit message regex for `CODE_ERROR` detection

If CI is added after a repo is connected, use the **Refresh CI** button in Settings → Repositories tab.

---

## Challenges & Lessons Learned

### Challenge 1 — Prisma Custom Output Path
**Problem:** Using `output = "../src/generated/prisma"` in `schema.prisma` caused Better Auth to throw `Model verification does not exist`.
**Fix:** Remove the custom `output` from the generator entirely. Always import from `@prisma/client`.

---

### Challenge 2 — `prisma generate` vs `prisma db push`
**Problem:** Running only `prisma generate` after schema changes doesn't create tables in the database.
**Fix:** Always run in order:
1. `npx prisma migrate dev --name describe-change`
2. `npx prisma generate`

---

### Challenge 3 — Better Auth `Verification` model mismatch
**Problem:** Manually written `Verification` model had required `createdAt`/`updatedAt` but Better Auth expects them as optional.
**Fix:** Use `npx @better-auth/cli generate` to auto-generate auth models.

---

### Challenge 4 — GitHub webhooks on localhost
**Problem:** GitHub cannot send webhooks to `localhost`.
**Fix:** Use Cloudflare Tunnel via `npm run tunnel`. Update `BETTER_AUTH_URL` with tunnel URL.

> ⚠️ Cloudflare Tunnel URL changes every restart. For a permanent URL use ngrok with a static domain.

---

### Challenge 5 — Inngest 401 Event Key Not Found
**Problem:** `inngest.send()` throwing `401 Event key not found` in development.
**Fix:** Set `isDev` on the Inngest client:
```ts
export const inngest = new Inngest({
  id: "github-resolver",
  isDev: process.env.NODE_ENV !== "production",
});
```

---

### Challenge 6 — Resolve Button Stuck on "Resolving"
**Problem:** When the API call failed, button stayed disabled with no way to reset.
**Fix:** Added `POST /api/github/reset-event`. Added Cancel (while resolving) and Retry (after failure) buttons.

---

### Challenge 7 — Empty `id` in Manually Seeded Events
**Problem:** Prisma Studio doesn't always apply `@default(cuid())` when field is left blank.
**Fix:** Use `scripts/seed-event.ts` to create test events programmatically.

---

### Challenge 8 — No Code Files in Test Commit
**Problem:** Seed script used latest commit SHA which only had `README.md`.
**Fix:** Updated seed script to scan last 10 commits for one with actual code files.

---

### Challenge 9 — `prisma db push` vs `prisma migrate dev`
**Problem:** Using `db push` meant no migration history and no production-safe deployment path.
**Fix:** Switched to `prisma migrate dev` from Phase 2 onwards.
- Development → `npx prisma migrate dev --name describe-change`
- Production → `npx prisma migrate deploy`
- Quick spikes only → `npx prisma db push`

---

### Challenge 10 — Duplicate Event Cards from Auto-Fix Push
**Problem:** When the resolver pushed a fix to `fix/auto-*` branch, GitHub fired a `push` webhook which matched the commit message regex and created a duplicate event card.
**Fix:** Added branch filter in webhook — any push to `refs/heads/fix/auto-*` is ignored before any parsing runs.

---

### Challenge 11 — Webhook Auto-Triggering Inngest
**Problem:** The webhook was calling `inngest.send()` on every event, meaning every incoming GitHub event automatically started a resolve job without user action.
**Fix:** Removed `inngest.send()` from the webhook entirely. Inngest is only triggered from `POST /api/github/resolve` when the user explicitly clicks "Resolve issue".

---

### Challenge 12 — PR `mergeable` Always Null in Webhook
**Problem:** Direct `mergeable === false` check in the webhook almost never fired because GitHub computes mergeable asynchronously — it's `null` when the webhook first arrives.
**Fix:** Created `check-pr-mergeable` Inngest function that polls with exponential backoff + jitter (3 attempts at ~10s, ~25s, ~45s). Only creates a `PR_CONFLICT` event when `mergeable === false` is confirmed.

---

### Challenge 13 — Duplicate Events for CI Repos
**Problem:** Repos with GitHub Actions were generating both a `CODE_ERROR` (from push commit message regex) and a `CI_FAILURE` (from check_run webhook) for the same failure.
**Fix:** Added `hasCI` flag to `Repo` model. Webhook skips push regex entirely when `hasCI = true`, relying solely on `CI_FAILURE` from `check_run` as the authoritative signal.

---

## Current Status

```
✅ Phase 1 — Foundation & Auth
  ✅ Next.js 14 project setup
  ✅ Prisma ORM + Neon PostgreSQL
  ✅ Better Auth + GitHub OAuth
  ✅ Login page
  ✅ TanStack Query provider
  ✅ Protected dashboard route + middleware

✅ Phase 2 — Event Ingestion
  ✅ Repositories page (connect/disconnect repos)
  ✅ API routes — fetch repos, connect, disconnect
  ✅ Webhook receiver — parse + save GitHub events
  ✅ Inngest setup + function registered

✅ Phase 3 — Dashboard UI
  ✅ Dashboard layout + shadcn sidebar
  ✅ Error feed with expanded cards
  ✅ Resolve button + inline job progress
  ✅ Cancel + Retry buttons for stuck/failed jobs
  ✅ Stat cards (open issues, resolved, PRs created)

✅ Phase 4 — AI Resolver
  ✅ Inngest step functions wired up
  ✅ GitHub context fetcher (CI failure, PR conflict, code error)
  ✅ Claude AI analysis + patch generation
  ✅ Structured prompt with strict JSON output rules
  ✅ withRetry wrapper for GitHub API resilience
  ✅ Idempotent branch + PR creation
  ✅ Auto PR opened with structured body

✅ Phase 5 — Polish & Fixes
  ✅ Activity log page — timeline, stats, filters, detail modal, pagination
  ✅ Settings page — profile, repos, danger zone, CI badge, refresh CI
  ✅ Dashboard UI fixes:
      ✅ Duplicate card fix — auto-fix push no longer creates new event
      ✅ Resolve modal — branch strategy selection (same/new/custom + skip)
      ✅ sourceBranch saved to DB and used in resolver
      ✅ Resolved card dot turns green
      ✅ PR link shown in green box on resolved cards
  ✅ Webhook overhaul:
      ✅ Removed auto inngest.send — resolve is manual only
      ✅ fix/auto-* branch filter
      ✅ Scenario 1 — resolved event reset to PENDING on new buggy push
      ✅ PR conflict detection via delayed Inngest polling with backoff + jitter
      ✅ CI detection — hasCI flag on Repo, skip push regex for CI repos
      ✅ Refresh CI button in settings

⬜ Phase 6 — Deployment
  ⬜ Environment variables audit for Vercel
  ⬜ Inngest production setup (signing key, event key)
  ⬜ Neon DB connection string for production
  ⬜ Deploy to Vercel
```

---

## Common Errors & Fixes

| Error | Cause | Fix |
|---|---|---|
| `Model verification does not exist` | Tables not in DB | Run `npx prisma migrate dev` |
| `Module '@prisma/client' has no exported member` | Custom output path | Remove `output` from generator |
| `404 on /login` | Login page not created | Create `app/login/page.tsx` |
| `500 on /api/auth/sign-in/social` | Auth models missing | Run `npx @better-auth/cli generate` |
| `Inngest 401 Event key not found` | Dev mode not set | Set `isDev: process.env.NODE_ENV !== "production"` |
| `No SHA found in CI_FAILURE payload` | Empty test payload | Use seed script with real commit SHA |
| `No files could be fetched` | Commit has no code files | Seed script scans 10 commits for code files |
| `Webhook 404 Not Found` | Missing `write:repo_hook` scope | Add scope to Better Auth GitHub provider |
| `Webhook Validation Failed — localhost` | GitHub can't reach localhost | Use Cloudflare Tunnel |
| `Resolve button stuck` | Job failed silently | Use Cancel/Retry buttons + reset-event API |
| `ECONNREFUSED in seed script` | `.env` not loaded | Add `dotenv.config()` at top of script |
| `Duplicate event card after resolve` | Auto-fix push triggered webhook | Add `fix/auto-*` branch filter in webhook |
| `PR_CONFLICT never fires` | `mergeable` is null at webhook time | Use `check-pr-mergeable` Inngest function with polling |
| `Duplicate CI_FAILURE + CODE_ERROR` | Push regex runs even with CI | Set `hasCI` on connect, skip push regex when true |
| `hasCI stale after adding workflows` | Flag set once at connect time | Use Refresh CI button in Settings |