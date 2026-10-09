import { verifyGithubSignature } from "@/src/lib/github/webhook-signature";
import prisma from "@/src/lib/prisma";
import {
  applyGithubPrWebhook,
  claimWebhookDelivery,
} from "@/src/lib/pr-outcome/service";
import { headers } from "next/headers";

// ISSUES-ONLY MODE: event-feed Inngest triggers temporarily disabled
// import { inngest } from "@/src/inngest/client";

export { verifyGithubSignature };

/**
 * Main webhook handler — receives all GitHub events for connected repositories.
 *
 * Phase 2: processes pull_request / pull_request_review for PrOutcome updates.
 * Event-feed GithubEvent creation / check-mergeable remains disabled.
 */
export async function POST(req: Request) {
  const headersList = await headers();
  const signature = headersList.get("x-hub-signature-256");
  const event = headersList.get("x-github-event");
  const deliveryId = headersList.get("x-github-delivery");

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

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(data) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const repository = payload.repository as { id?: number } | undefined;
  const repoGithubId = repository?.id;

  if (!repoGithubId) {
    return Response.json({ received: true });
  }

  const repo = await prisma.repo.findUnique({
    where: { githubId: repoGithubId },
  });

  if (!repo) {
    return Response.json({ received: true });
  }

  // Phase 2: PR outcome tracking (does not revive event-feed cards)
  if (event === "pull_request" || event === "pull_request_review") {
    if (deliveryId) {
      const claimed = await claimWebhookDelivery({
        deliveryId,
        event,
        action:
          typeof payload.action === "string" ? payload.action : null,
        repoId: repo.id,
      });
      if (!claimed) {
        return Response.json({ received: true, duplicate: true });
      }
    }

    try {
      const pullRequest = (payload.pull_request ??
        (payload.review as { pull_request?: unknown } | undefined)
          ?.pull_request) as
        | {
            number?: number;
            html_url?: string;
            state?: string;
            merged?: boolean;
            updated_at?: string;
          }
        | undefined;

      // pull_request_review payloads nest PR under pull_request at top level
      const pr =
        (payload.pull_request as typeof pullRequest) ?? pullRequest;

      const review = payload.review as { state?: string } | undefined;
      const action = typeof payload.action === "string" ? payload.action : "";
      const prNumber = pr?.number;

      if (!prNumber || !action) {
        return Response.json({ received: true, mode: "issues-only" });
      }

      const result = await applyGithubPrWebhook({
        repoId: repo.id,
        event,
        action,
        prNumber,
        prUrl: pr?.html_url ?? null,
        prState: pr?.state ?? null,
        merged: pr?.merged ?? null,
        reviewState: review?.state ?? null,
        githubUpdatedAt: pr?.updated_at ? new Date(pr.updated_at) : null,
      });

      return Response.json({
        received: true,
        outcome: result.status,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[webhook] pr-outcome apply failed:", {
        repoId: repo.id,
        event,
        error: message,
      });
      // Resilient: do not 500 the webhook for application/DB issues after claim
      return Response.json({ received: true, outcome: "error" });
    }
  }

  // ISSUES-ONLY MODE: acknowledge other events; do not create GithubEvent cards
  // or trigger PR-mergeable / event-resolve jobs.
  return Response.json({ received: true, mode: "issues-only" });
}
