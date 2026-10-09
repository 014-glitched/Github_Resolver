import type { PrOutcomeStateValue } from "./schema";

export type DesiredPrOutcome = {
  state: PrOutcomeStateValue;
  openedAt?: Date | null;
  mergedAt?: Date | null;
  closedAt?: Date | null;
  changesRequestedAt?: Date | null;
};

/**
 * Consistency rules:
 * - MERGED is terminal — never regress.
 * - Ignore events older than stored githubUpdatedAt.
 * - CLOSED_UNMERGED may reopen to OPEN.
 * - CHANGES_REQUESTED clears to OPEN on later open-PR activity.
 */
export function isStaleGithubUpdate(
  existingGithubUpdatedAt: Date | null | undefined,
  incomingGithubUpdatedAt: Date | null | undefined,
): boolean {
  if (!existingGithubUpdatedAt || !incomingGithubUpdatedAt) return false;
  return incomingGithubUpdatedAt.getTime() < existingGithubUpdatedAt.getTime();
}

export function shouldApplyDesiredState(
  current: PrOutcomeStateValue | null | undefined,
  desired: PrOutcomeStateValue,
): boolean {
  if (current === "MERGED") return false;
  if (current === desired) return true;
  return true;
}

export function mapPullRequestAction(input: {
  action: string;
  merged: boolean | null | undefined;
  prState: string | null | undefined;
}): DesiredPrOutcome | null {
  const { action, merged, prState } = input;

  if (action === "closed") {
    if (merged) {
      return {
        state: "MERGED",
        mergedAt: new Date(),
        closedAt: new Date(),
      };
    }
    return {
      state: "CLOSED_UNMERGED",
      closedAt: new Date(),
    };
  }

  if (
    action === "opened" ||
    action === "reopened" ||
    action === "synchronize"
  ) {
    // Only treat as OPEN if GitHub still considers the PR open
    if (prState && prState !== "open") return null;
    return {
      state: "OPEN",
      openedAt: action === "opened" ? new Date() : undefined,
      closedAt: null,
    };
  }

  return null;
}

export function mapPullRequestReviewAction(input: {
  action: string;
  reviewState: string | null | undefined;
  prState: string | null | undefined;
}): DesiredPrOutcome | null {
  if (input.action !== "submitted") return null;
  if (input.reviewState !== "changes_requested") return null;
  if (input.prState && input.prState !== "open") return null;

  return {
    state: "CHANGES_REQUESTED",
    changesRequestedAt: new Date(),
  };
}
