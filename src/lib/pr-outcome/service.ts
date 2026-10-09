import prisma from "@/src/lib/prisma";

import {
  isStaleGithubUpdate,
  mapPullRequestAction,
  mapPullRequestReviewAction,
  shouldApplyDesiredState,
  type DesiredPrOutcome,
} from "./state";
import { toPrOutcomeView, type PrOutcomeRow } from "./view";

export type UpsertOutcomeOnPrCreatedInput = {
  userId: string;
  repoId: string;
  jobId: string;
  issueNumber: number;
  prNumber: number;
  prUrl: string;
  openedAt?: Date;
  githubUpdatedAt?: Date | null;
};

/**
 * Claim a GitHub delivery ID. Returns false if already processed.
 */
export async function claimWebhookDelivery(input: {
  deliveryId: string;
  event: string;
  action?: string | null;
  repoId?: string | null;
}): Promise<boolean> {
  try {
    await prisma.webhookDelivery.create({
      data: {
        deliveryId: input.deliveryId,
        event: input.event,
        action: input.action ?? null,
        repoId: input.repoId ?? null,
      },
    });
    return true;
  } catch (err: unknown) {
    // Unique constraint → duplicate delivery
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes("Unique constraint") ||
      message.includes("WebhookDelivery_deliveryId")
    ) {
      return false;
    }
    throw err;
  }
}

/**
 * Upsert OPEN outcome when Resolve successfully creates/reuses a PR.
 * Safe on Inngest retries (jobId unique + repoId/prNumber unique).
 */
export async function upsertOutcomeOnPrCreated(
  input: UpsertOutcomeOnPrCreatedInput,
): Promise<PrOutcomeRow> {
  const now = input.openedAt ?? new Date();

  const row = await prisma.prOutcome.upsert({
    where: { jobId: input.jobId },
    create: {
      userId: input.userId,
      repoId: input.repoId,
      jobId: input.jobId,
      issueNumber: input.issueNumber,
      prNumber: input.prNumber,
      prUrl: input.prUrl,
      state: "OPEN",
      openedAt: now,
      lastObservedAt: now,
      githubUpdatedAt: input.githubUpdatedAt ?? null,
    },
    update: {
      // Do not regress MERGED on retry; only refresh identity fields if still open-ish
      prNumber: input.prNumber,
      prUrl: input.prUrl,
      lastObservedAt: now,
    },
  });

  // If create raced on (repoId, prNumber), fetch existing
  return row;
}

type ApplyResult =
  | { status: "applied"; view: ReturnType<typeof toPrOutcomeView> }
  | { status: "ignored"; reason: string }
  | { status: "unknown_pr" };

function buildUpdateData(
  desired: DesiredPrOutcome,
  githubUpdatedAt: Date | null,
  now: Date,
) {
  const data: {
    state: DesiredPrOutcome["state"];
    lastObservedAt: Date;
    githubUpdatedAt: Date | null;
    openedAt?: Date | null;
    mergedAt?: Date | null;
    closedAt?: Date | null;
    changesRequestedAt?: Date | null;
  } = {
    state: desired.state,
    lastObservedAt: now,
    githubUpdatedAt,
  };

  if (desired.openedAt !== undefined) data.openedAt = desired.openedAt;
  if (desired.mergedAt !== undefined) data.mergedAt = desired.mergedAt;
  if (desired.closedAt !== undefined) {
    data.closedAt = desired.closedAt;
    // Reopen clears closedAt when explicitly null
    if (desired.state === "OPEN") data.closedAt = null;
  }
  if (desired.changesRequestedAt !== undefined) {
    data.changesRequestedAt = desired.changesRequestedAt;
  }
  if (desired.state === "OPEN") {
    // Clear closed marker on reopen; keep changesRequestedAt historically
    data.closedAt = null;
  }

  return data;
}

/**
 * Apply a GitHub pull_request or pull_request_review event to PrOutcome.
 * Unknown PRs (not linked to an AI job) are ignored safely.
 */
export async function applyGithubPrWebhook(input: {
  repoId: string;
  event: string;
  action: string;
  prNumber: number;
  prUrl?: string | null;
  prState?: string | null;
  merged?: boolean | null;
  reviewState?: string | null;
  githubUpdatedAt?: Date | null;
}): Promise<ApplyResult> {
  const now = new Date();

  let desired: DesiredPrOutcome | null = null;
  if (input.event === "pull_request") {
    desired = mapPullRequestAction({
      action: input.action,
      merged: input.merged,
      prState: input.prState,
    });
  } else if (input.event === "pull_request_review") {
    desired = mapPullRequestReviewAction({
      action: input.action,
      reviewState: input.reviewState,
      prState: input.prState,
    });
  }

  if (!desired) {
    return { status: "ignored", reason: "unhandled_action" };
  }

  const existing = await prisma.prOutcome.findUnique({
    where: {
      repoId_prNumber: {
        repoId: input.repoId,
        prNumber: input.prNumber,
      },
    },
  });

  if (!existing) {
    console.info("[pr-outcome] unknown PR — not an AI resolve job", {
      repoId: input.repoId,
      prNumber: input.prNumber,
      event: input.event,
      action: input.action,
    });
    return { status: "unknown_pr" };
  }

  if (
    isStaleGithubUpdate(existing.githubUpdatedAt, input.githubUpdatedAt ?? null)
  ) {
    console.info("[pr-outcome] stale event ignored", {
      repoId: input.repoId,
      prNumber: input.prNumber,
      existingGithubUpdatedAt: existing.githubUpdatedAt?.toISOString(),
      incomingGithubUpdatedAt: input.githubUpdatedAt?.toISOString(),
    });
    return { status: "ignored", reason: "stale" };
  }

  if (!shouldApplyDesiredState(existing.state, desired.state)) {
    console.info("[pr-outcome] terminal MERGED — skip regress", {
      repoId: input.repoId,
      prNumber: input.prNumber,
      desired: desired.state,
    });
    return { status: "ignored", reason: "merged_terminal" };
  }

  // Same state: still refresh lastObservedAt / githubUpdatedAt when newer
  if (existing.state === desired.state && desired.state !== "MERGED") {
    const updated = await prisma.prOutcome.update({
      where: { id: existing.id },
      data: {
        lastObservedAt: now,
        githubUpdatedAt:
          input.githubUpdatedAt ?? existing.githubUpdatedAt ?? null,
        ...(input.prUrl ? { prUrl: input.prUrl } : {}),
      },
    });
    return { status: "applied", view: toPrOutcomeView(updated) };
  }

  if (existing.state === desired.state && desired.state === "MERGED") {
    return { status: "ignored", reason: "already_merged" };
  }

  const updated = await prisma.prOutcome.update({
    where: { id: existing.id },
    data: {
      ...buildUpdateData(desired, input.githubUpdatedAt ?? null, now),
      ...(input.prUrl ? { prUrl: input.prUrl } : {}),
      // Preserve openedAt if already set
      ...(desired.state === "OPEN" && !existing.openedAt && desired.openedAt
        ? { openedAt: desired.openedAt }
        : {}),
      ...(desired.state === "OPEN" && existing.openedAt
        ? { openedAt: existing.openedAt }
        : {}),
    },
  });

  console.info("[pr-outcome] state updated", {
    repoId: input.repoId,
    prNumber: input.prNumber,
    from: existing.state,
    to: updated.state,
  });

  return { status: "applied", view: toPrOutcomeView(updated) };
}

export async function getPrOutcomesForRepo(
  repoId: string,
): Promise<Map<string, PrOutcomeRow>> {
  const rows = await prisma.prOutcome.findMany({ where: { repoId } });
  return new Map(rows.map((row) => [row.jobId, row]));
}

export { toPrOutcomeView };
