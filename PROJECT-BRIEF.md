# GitHubResolver — Project Brief

AI-powered GitHub ops tool that connects to your repositories, surfaces open issues, and uses Claude to generate fixes and open review-ready pull requests.

---

## How it works

```
GitHub OAuth → Connect repos → Browse Issues → Resolve with AI → Review PR on GitHub
```

1. **Sign in** with GitHub (Better Auth OAuth).
2. **Connect repositories** from the dashboard; webhooks can be registered for future event-based flows.
3. **Issues page** loads open GitHub Issues for each connected repo and merges them with any in-progress AI jobs.
4. User picks an issue, chooses a branch strategy (same / new / custom), and clicks **Resolve with AI**.
5. **Inngest** runs a background job that:
   - Fetches issue context (body, comments, relevant files)
   - Asks Claude to generate a fix
   - Optionally verifies the fix (self-critique pass)
   - Creates a branch, commits, and opens a PR (body includes `Closes #N`)
6. The UI polls job status and shows progress + the PR link when complete.

**Current product focus (Issues-only mode):**  
The CI / commit-error / PR-conflict event feed is temporarily disabled. Only the **Issues** resolution path is live. Repo connect, settings, and auth still work.

---

## What has been built

### Done

| Area | Details |
|---|---|
| Auth | Better Auth + GitHub OAuth, login + landing pages |
| Database | Prisma schema (User, Repo, GithubEvent, ResolveJob, GithubIssueJob) + Neon Postgres |
| Repos | Connect / disconnect, webhook registration, CI detection (`hasCI`) |
| Issues | Dashboard Issues UI, APIs, Inngest `resolve-github-issue` pipeline |
| Event pipeline (code exists) | Webhook parsing, PR mergeable polling, Claude event resolver, Activity + Settings pages |
| Deploy path | Vercel-oriented env (`BETTER_AUTH_URL`), Prisma generate on build |
| UI | Fullscreen landing/login, glassmorph CTAs, product-preview hero |

### Temporarily disabled (Issues-only)

- Dashboard event feed (CI failures, code errors, PR conflicts)
- Activity nav entry
- Event resolve / reset APIs (return 410)
- Webhook creation of `GithubEvent` cards
- Inngest registration of `resolveGithubEvent` and `checkPrMergeable`

### Still manual / ops

- Set GitHub OAuth App homepage + callback to the Vercel URL  
  (`…/api/auth/callback/github`)
- Set `BETTER_AUTH_URL` (and other secrets) in Vercel
- Disable Vercel Deployment Protection if the public URL hits Vercel login
- Production Inngest keys (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`)

---

## Tech stack

| Layer | Technology |
|---|---|
| App framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| UI | Tailwind CSS 4, shadcn/ui, Radix UI, lucide-react |
| Auth | Better Auth (GitHub OAuth) |
| Client data | TanStack Query |
| Database | PostgreSQL (Neon) |
| ORM | Prisma 7 |
| Jobs | Inngest |
| AI | Anthropic SDK (Claude) |
| GitHub | Octokit (API, webhooks, PRs) |
| Hosting | Vercel + Neon |

---

## Local development

```bash
npm install
npm run dev          # Next.js
npm run inngest      # Inngest dev server (needed for resolve jobs)
```

Required env vars (see `.env`):  
`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`  
(+ Inngest keys in production)

---

## Portfolio one-liner

**GitHubResolver** — Connect repos, detect issues, and auto-open AI-generated fix PRs from a single dashboard.
