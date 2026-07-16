import { inngest } from "@/src/inngest/client";
import prisma from "@/src/lib/prisma";
import * as crypto from "crypto";
import { headers } from "next/headers";

/**
 * Verifies that the incoming webhook payload was sent by GitHub
 * by comparing the HMAC SHA-256 signature against our webhook secret.
 * This prevents malicious actors from sending fake webhook events.
 */
function verifyGithubSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

/**
 * Main webhook handler — receives all GitHub events for connected repositories.
 *
 * Flow:
 * 1. Validate signature to confirm the request is from GitHub
 * 2. Find the repo in our DB — ignore events for unconnected repos
 * 3. PR events → hand off to Inngest for delayed mergeable check
 * 4. Other events → parse, deduplicate, and save to DB
 *
 * Note: Resolve jobs are never triggered here.
 * Resolution only happens when the user clicks "Resolve issue" on the dashboard.
 */
export async function POST(req: Request) {
  const headersList = await headers();
  const signature = headersList.get("x-hub-signature-256");
  const event = headersList.get("x-github-event");

  if (!signature || !event) {
    return Response.json({ error: "Missing headers" }, { status: 400 });
  }

  const data = await req.text();

  // Verify the webhook signature if a secret is configured
  if (process.env.GITHUB_WEBHOOK_SECRET) {
    const isValid = verifyGithubSignature(
      data,
      signature,
      process.env.GITHUB_WEBHOOK_SECRET,
    );
    if (!isValid) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const payload = JSON.parse(data);
  const repoGithubId = payload.repository?.id;

  if (!repoGithubId) {
    return Response.json({ received: true });
  }

  // Only process events for repos that are connected in our app
  const repo = await prisma.repo.findUnique({
    where: { githubId: repoGithubId },
    include: { user: true },
  });

  if (!repo) {
    return Response.json({ received: true });
  }

  /**
   * PR conflict detection — handed off to Inngest instead of checked directly.
   *
   * GitHub's mergeable field is null when the webhook first fires because
   * GitHub runs its merge simulation asynchronously. We send the PR data
   * to Inngest which waits and polls with backoff + jitter until GitHub
   * returns a definitive mergeable value.
   */
  if (event === "pull_request") {
    if (["opened", "synchronize", "reopened"].includes(payload.action)) {
      const prNumber = payload.pull_request?.number;
      const prTitle = payload.pull_request?.title ?? "Untitled PR";
      const sourceBranch = payload.pull_request?.head?.ref ?? null;

      if (prNumber) {
        await inngest.send({
          name: "github/pr.check-mergeable",
          data: {
            repoId: repo.id,
            userId: repo.userId,
            prNumber,
            prTitle,
            repoFullName: repo.fullName,
            sourceBranch,
          },
        });
      }
    // On synchronize — a new commit was pushed to this PR branch.
    // Parse the commit message for error patterns (same logic as push handler).
    // This covers repos WITH ci too — ci_failure will also fire separately
    // but deduplication will drop it if a card already exists within 10 min.
    if (payload.action === "synchronize" && !repo.hasCI) {
      const headCommitMessage: string =
        payload.pull_request?.head?.sha
          ? `${payload.after ?? ""}`
          : "";
    
      // The synchronize payload doesn't have commits[], but the
      // pull_request.title + body often reflects the latest push.
      // More reliably: check payload.sender and payload.pull_request.head.sha
      // We use the PR title as a fallback error signal.
      const commitMsg: string =
        (payload.pull_request?.body ?? "") +
        " " +
        (payload.pull_request?.title ?? "");

      const hasErrorSignal =
        /TypeError|SyntaxError|ReferenceError|RangeError|Error:|fatal:|error TS[0-9]+|Cannot find|failed to compile|compilation failed|build failed|npm ERR!/i.test(
          commitMsg,
        );

      if (hasErrorSignal && sourceBranch) {
        // Check dedup window
        const existing = await prisma.githubEvent.findFirst({
          where: {
            repoId: repo.id,
            type: "CODE_ERROR",
            status: { in: ["PENDING", "RESOLVING"] },
            createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
          },
        });

        if (!existing) {
          await prisma.githubEvent.create({
            data: {
              userId: repo.userId,
              repoId: repo.id,
              type: "CODE_ERROR",
              title: `Error in PR: ${prTitle}`,
              description: `New commit on PR #${prNumber} contains error signals — ${repo.fullName}`,
              sourceBranch,
              payload,
              status: "PENDING",
            },
          });
        }
      }
    }
      return Response.json({ received: true });
    }
  }

  // Parse the raw GitHub event into our internal event format
  const githubEvent = parseGithubEvent(event, payload, repo.hasCI);
  if (!githubEvent) {
    return Response.json({ received: true });
  }

  /**
   * Scenario 1 — Re-opened issue on a previously resolved branch.
   *
   * If a new buggy push comes in on the same branch as a resolved event,
   * we reset that event back to PENDING instead of creating a duplicate card.
   * The resolve job is also cleared so it can be re-run cleanly.
   */
  if (githubEvent.sourceBranch) {
    const resolvedEvent = await prisma.githubEvent.findFirst({
      where: {
        repoId: repo.id,
        type: githubEvent.type,
        status: "RESOLVED",
        sourceBranch: githubEvent.sourceBranch,
      },
      include: { resolveJob: true },
      orderBy: { createdAt: "desc" },
    });

    if (resolvedEvent) {
      // Reset event back to PENDING with fresh title, description and payload
      await prisma.githubEvent.update({
        where: { id: resolvedEvent.id },
        data: {
          status: "PENDING",
          title: githubEvent.title,
          description: githubEvent.description,
          payload: payload,
          updatedAt: new Date(),
        },
      });

      // Clear old resolve job so it can be queued again from scratch
      if (resolvedEvent.resolveJob) {
        await prisma.resolveJob.update({
          where: { eventId: resolvedEvent.id },
          data: {
            status: "QUEUED",
            prUrl: null,
            prNumber: null,
            errorMsg: null,
            startedAt: null,
            completedAt: null,
          },
        });
      }

      return Response.json({ received: true });
    }
  }

  /**
   * Deduplication — prevents multiple cards for the same error burst.
   *
   * If an identical event type is already PENDING or RESOLVING for this repo
   * within the last 10 minutes, we silently drop the duplicate.
   * This handles cases like multiple CI checks failing in quick succession.
   */
  const existing = await prisma.githubEvent.findFirst({
    where: {
      repoId: repo.id,
      type: githubEvent.type,
      status: { in: ["PENDING", "RESOLVING"] },
      createdAt: {
        gte: new Date(Date.now() - 10 * 60 * 1000),
      },
    },
  });

  if (existing) {
    return Response.json({ received: true });
  }

  // Save the new event — user will resolve it manually from the dashboard
  await prisma.githubEvent.create({
    data: {
      userId: repo.userId,
      repoId: repo.id,
      type: githubEvent.type,
      title: githubEvent.title,
      description: githubEvent.description,
      sourceBranch: githubEvent.sourceBranch ?? null,
      payload: payload,
      status: "PENDING",
    },
  });

  return Response.json({ received: true });
}

/**
 * Parses a raw GitHub webhook event into our internal event format.
 *
 * Supported event types:
 * - CI_FAILURE  → check_run completed with conclusion "failure"
 * - CODE_ERROR  → push containing commit messages with actual error output
 *
 * PR_CONFLICT is intentionally NOT handled here — it goes through the
 * delayed Inngest mergeable check instead (see above).
 *
 * Returns null for events we don't care about — these are silently ignored.
 */
function parseGithubEvent(event: string, payload: any, hasCI: boolean) {
  /**
   * CI failure — fires when a GitHub Actions check run completes with a failure.
   * Only tracks definitive failures, not cancelled or skipped runs.
   */
  if (event === "check_run" && payload.action === "completed") {
    if (payload.check_run?.conclusion === "failure") {
      return {
        type: "CI_FAILURE" as const,
        title: `CI Failed: ${payload.check_run.name}`,
        description: `Check run failed on ${payload.repository.full_name} — ${payload.check_run.html_url}`,
        sourceBranch: payload.check_run?.check_suite?.head_branch ?? null,
      };
    }
  }

  /**
   * Code error — fires on push events where commit messages contain
   * actual error output patterns (TypeErrors, build failures, etc).
   *
   * Intentionally strict — normal commit messages like "fix: resolve bugs"
   * or "error handling improvements" will NOT trigger this.
   *
   * Pushes to resolver's own fix/auto-* branches are always ignored
   * to prevent the resolver's own commits from creating new events.
   */
  if (event === "push" && !hasCI) {
    const pushedBranch = payload.ref ?? "";

    // Ignore the resolver's own auto-fix branches
    if (pushedBranch.startsWith("refs/heads/fix/auto-")) {
      return null;
    }

    const commits = payload.commits ?? [];
    const errorCommit = commits.find((c: any) =>
      /TypeError|SyntaxError|ReferenceError|RangeError|Error:|fatal:|error TS[0-9]+|Cannot find|failed to compile|compilation failed|build failed|npm ERR!/i.test(
        c.message,
      ),
    );

    if (errorCommit) {
      return {
        type: "CODE_ERROR" as const,
        title: `Error Push: ${errorCommit.message}`,
        description: `Push to ${payload.repository.full_name} — ${errorCommit.message}`,
        sourceBranch: pushedBranch.replace("refs/heads/", "") || null,
      };
    }
  }

  return null;
}