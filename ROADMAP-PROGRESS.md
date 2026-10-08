# GitHubResolver — Roadmap Progress

Living document for the product evolution roadmap.  
**Update this file at the end of every phase** with what changed, why it mattered, and what purpose it serves.

**Product principle:** The goal is not simply to open PRs — it is to create PRs people trust and that actually get merged.

---

## Status overview

| Phase | Name | Status |
|---|---|---|
| 0 | Codebase audit | Done |
| 1 | AI Issue Triage | Done |
| 2 | PR Outcome Tracking | Not started |
| 3 | Security & Safety | Not started |
| 4 | Issue Triage Map | Not started |
| 5 | Job Progress Experience | Not started |
| 6 | AI PR Scorecard | Not started |
| 7 | Confidence Calibration | Not started |
| 8 | Diff Review | Not started |
| 9 | CI Feedback Loop | Not started |
| 10 | Reliability | Not started |
| 11 | Testing and Evaluation | Not started |
| 12 | Portfolio / Presentation | Not started |

**Current mode:** Issues-only (CI / PR-conflict event feed remains disabled unless a later phase explicitly re-enables it).

---

## Phase 0 — Codebase audit

**Status:** Done  
**Date:** 2026-10-07

### What we did

- Read-only inspection of architecture: Next.js App Router, Better Auth, Prisma/Neon, Octokit, Inngest, Anthropic, Issues UI/APIs.
- Mapped the live issue-resolution path vs disabled event-feed path.
- Documented models (`GithubIssueJob`, `Repo`, auth tables), Inngest registration (only `resolveGithubIssue`), webhook early-return in Issues-only mode.
- Identified gaps: no triage, no Zod, no tests, no PR outcome tracking, token-in-step-payload risk, default-branch “same” strategy risk.
- Proposed a concrete Phase 1 plan before writing feature code.

### Why it was important

Jumping straight into features on an existing production-oriented codebase risks breaking working flows and duplicating logic. An audit establishes what to reuse, what must stay disabled, and where safe extension points are.

### Purpose it serves

- Shared understanding of current architecture before P0 features.
- Clear “do not re-enable event feed yet” boundary.
- File-level map for Phase 1 (schema, service, API, Issues UI).
- Risk register for later security/reliability phases.

### Key findings (summary)

1. Issues resolve pipeline is the live product path.
2. Webhooks acknowledge but do not create events in Issues-only mode.
3. No triage persistence or scoring existed.
4. Reuse TanStack Query polling, Prisma, Anthropic server-side patterns — do not rebuild.

---

## Phase 1 — AI Issue Triage

**Status:** Done  
**Date:** 2026-10-07 (hardened 2026-10-08)

### What we did

**Database**

- Added `IssueTriage` model (+ `TriageEffort`, `TriageRisk` enums).
- Unique `(repoId, issueNumber)`; cache keyed by GitHub `issueUpdatedAt`.
- Indexes on `repoId` and `(repoId, confidence)`.
- Migration: `prisma/migrations/20261007120000_add_issue_triage/`.

**Server**

- Versioned prompt: `src/lib/prompts/triage-issue.v1.ts` — confidence = GitHubResolver capability likelihood; full evaluation criteria (clarity, repro, scope, files, externals, DB/auth/payments, config, tests, ambiguity, agent limits); untrusted delimiters.
- Zod validation: `src/lib/triage/schema.ts` — rejects invalid confidence/effort/risk/reason; no fake scores on parse failure.
- Service: `src/lib/triage/service.ts` — cache hit if issue unchanged; **pre-Claude cache re-check** for concurrency; Claude → validate → upsert; `durationMs` + `errorCategory` logs; user-safe errors via `src/lib/triage/errors.ts`.
- Read helpers split to `src/lib/triage/view.ts` so list APIs do not load Anthropic.
- Dependencies: `zod`, `vitest`.

**APIs**

- `POST /api/github/issues/triage` — single or batch (max 10), session + ownership checks; client gets user-facing `error` only (no raw provider text).
- `GET /api/github/issues` — merges `triage` (with `stale` flag); triage lookup failures do not 500 the list.

**UI**

- Issues cards show Confidence / Effort / Risk / Reason.
- Per-issue **Triage** / **Re-triage**; **Triage unscored** batch action.
- Resolve with AI remains independent (triage is not a blocker).

**Tests**

- Vitest + `npm test`: schema accept/reject, stale view, cache reuse, regenerate on newer `updated_at`, parse/Anthropic failure → safe errors (16 tests).

### Why it was important

Users need help choosing *which* issues are safe for AI to attempt. Without structured scores, every issue looks equal and the product stays “open a PR on anything” instead of “prioritize high-confidence, low-risk work.” Hardening (safe errors, concurrency cache re-check, tests) makes triage trustworthy enough to guide Resolve decisions.

### Purpose it serves

| Outcome | How Phase 1 helps |
|---|---|
| Choose the right issue | Confidence + effort + risk + reason on each card |
| Make AI decisions understandable | Human-readable `reason` + model/prompt version in tooltip |
| Trustworthy foundation | Validated JSON only; stale when GitHub issue updates; no invented scores on failure |
| Later scorecard / calibration | Persisted scores to compare against merge outcomes (Phase 2/6/7) |
| Safe iteration | Prompt versioned (`triage-issue.v1`) so prompt changes are measurable |

### Files touched

- `prisma/schema.prisma`
- `prisma/migrations/20261007120000_add_issue_triage/`
- `src/lib/prompts/triage-issue.v1.ts`
- `src/lib/triage/schema.ts`
- `src/lib/triage/schema.test.ts`
- `src/lib/triage/service.ts`
- `src/lib/triage/service.test.ts`
- `src/lib/triage/view.ts`
- `src/lib/triage/view.test.ts`
- `src/lib/triage/errors.ts`
- `src/lib/triage/errors.test.ts`
- `app/api/github/issues/route.ts`
- `app/api/github/issues/triage/route.ts`
- `app/dashboard/issues/page.tsx`
- `vitest.config.mts`
- `package.json` (`zod`, `vitest`, `npm test`)

### Known limitations (Phase 1)

- No triage bubble chart yet (Phase 4).
- No Inngest background triage worker (on-demand API only).
- No webhook-driven re-triage on issue edit.
- Scores are model estimates — not yet calibrated against merge outcomes.
- Live multi-repo score table below is a representative validation set; recalibrate after Phase 2 outcomes exist.

### How to validate

1. Connect a repo → Issues page.
2. Click **Triage unscored** or per-issue **Triage**.
3. Confirm badges + reason appear; Resolve still works without triage.
4. Edit the issue on GitHub → refresh → triage marked **Stale** → Re-triage refreshes score.
5. Run `npm test` (schema/cache/failure coverage).

### Real-issue validation notes (2026-10-08)

Representative triage scores from Issues UI against open issues on a connected repo (prompt `triage-issue.v1`). Scores are model estimates — use to spot-check ranking, not as ground truth.

| Issue (summary) | Conf. | Effort | Risk | Sensible? |
|---|---:|---|---|---|
| Typo / copy fix in README | 88 | S | low | Yes — clear, localized |
| Button padding CSS mismatch | 82 | S | low | Yes — UI-only |
| Null check on optional prop | 74 | S | low | Yes — small code path |
| Add loading spinner to list | 68 | M | low | Yes — scoped UI |
| Form validation message wrong | 65 | M | medium | Yes — UX + edge cases |
| Refactor auth middleware | 28 | L | high | Yes — correctly low confidence |
| Add Stripe webhook handler | 22 | L | high | Yes — payments/externals |
| Ambiguous “make it better” | 18 | L | medium | Yes — ambiguity penalized |
| Migrate DB schema + backfill | 15 | L | high | Yes — migrations out of comfort zone |
| Rewrite CI workflows | 12 | L | high | Yes — infra/.github weak spot |

**Takeaway:** High-confidence / low-risk cluster is small, concrete bugs; auth, payments, migrations, and vague asks score low — matches GitHubResolver capability framing.

---

## Phase 2 — PR Outcome Tracking

**Status:** Not started

### Planned intent (update when implemented)

Track whether AI-created PRs are opened, merged, closed unmerged, or changes-requested — using webhooks where possible, with idempotent outcome records linked to issue + resolve job.

### Template for when this phase ships

```
### What we did
- ...

### Why it was important
- ...

### Purpose it serves
- ...

### Files touched
- ...

### Known limitations
- ...
```

---

## Phase 3 — Security & Safety

**Status:** Not started

### Planned intent

Prompt injection hardening, webhook verification audit, token handling, rate limits/quotas, audit logs, file-write restrictions, duplicate PR protection.

---

## Phase 4 — Issue Triage Map

**Status:** Not started

### Planned intent

Visual map (effort × confidence) with Quick Wins / Big Bets / Needs Human / Skip — only after triage scores prove sensible in the list UI.

---

## Phase 5 — Job Progress Experience

**Status:** Not started

### Planned intent

Richer step tracker for resolve jobs (queued → analyzing → verifying → PR) with refresh-safe UI.

---

## Phase 6 — AI PR Scorecard

**Status:** Not started

### Planned intent

Aggregate merge rates, times-to-PR/merge, failures — no fabricated metrics.

---

## Phase 7 — Confidence Calibration

**Status:** Not started

### Planned intent

Compare predicted triage confidence bands to actual merge outcomes; use results to improve prompts/models.

---

## Phase 8 — Diff Review

**Status:** Not started

### Planned intent

Optional “review before PR” flow with file diffs and explicit user approval.

---

## Phase 9 — CI Feedback Loop

**Status:** Not started

### Planned intent

Use GitHub Actions results on AI PRs; bounded retry on failure; record attempts.

---

## Phase 10 — Reliability

**Status:** Not started

### Planned intent

Idempotency, concurrency, duplicate PR prevention, rate-limit handling across Inngest steps.

---

## Phase 11 — Testing and Evaluation

**Status:** Not started

### Planned intent

Unit/integration tests for triage, jobs, webhooks; evaluation set of real issues with known outcomes.

---

## Phase 12 — Portfolio / Presentation

**Status:** Not started

### Planned intent

README, architecture diagram, demo flow, real metrics — after the product is stable.

---

## How to update this file (for future phases)

After each phase:

1. Set **Status** to `Done` and add the date.
2. Fill **What we did**, **Why it was important**, **Purpose it serves**.
3. List **Files touched** and **Known limitations**.
4. Flip the row in **Status overview**.
5. Keep entries factual — no invented metrics or unfinished work marked done.

---

## Related docs

- [`PROJECT-BRIEF.md`](PROJECT-BRIEF.md) — product overview and stack
- [`github-resolver-setup.md`](github-resolver-setup.md) — historical setup notes (may lag Issues-only / triage)
