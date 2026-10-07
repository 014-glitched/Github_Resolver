import prisma from "@/src/lib/prisma";
import * as crypto from "crypto";
import { headers } from "next/headers";

// ISSUES-ONLY MODE: event-feed Inngest triggers temporarily disabled
// import { inngest } from "@/src/inngest/client";

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
 * ISSUES-ONLY MODE: signature + repo lookup still run so webhooks stay valid,
 * but CI / CODE_ERROR / PR_CONFLICT GithubEvent creation is disabled.
 * Resolution for GitHub Issues happens via /dashboard/issues only.
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

  // ISSUES-ONLY MODE: acknowledge webhook but do not create GithubEvent cards
  // or trigger PR-mergeable / event-resolve jobs.
  return Response.json({ received: true, mode: "issues-only" });

  /*
  // ── DISABLED: event-feed webhook processing (restore when re-enabling Dashboard) ──

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

      if (payload.action === "synchronize" && !repo.hasCI) {
        const commitMsg: string =
          (payload.pull_request?.body ?? "") +
          " " +
          (payload.pull_request?.title ?? "");

        const hasErrorSignal =
          /TypeError|SyntaxError|ReferenceError|RangeError|Error:|fatal:|error TS[0-9]+|Cannot find|failed to compile|compilation failed|build failed|npm ERR!/i.test(
            commitMsg,
          );

        if (hasErrorSignal && sourceBranch) {
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

  const githubEvent = parseGithubEvent(event, payload, repo.hasCI);
  if (!githubEvent) {
    return Response.json({ received: true });
  }

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
  */
}

/*
// ISSUES-ONLY MODE: parseGithubEvent disabled with event-feed path above.
function parseGithubEvent(event: string, payload: any, hasCI: boolean) {
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

  if (event === "push" && !hasCI) {
    const pushedBranch = payload.ref ?? "";

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
*/
