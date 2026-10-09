import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, upsert, update, createDelivery } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  createDelivery: vi.fn(),
}));

vi.mock("@/src/lib/prisma", () => ({
  default: {
    prOutcome: {
      findUnique,
      upsert,
      update,
    },
    webhookDelivery: {
      create: createDelivery,
    },
  },
}));

import {
  applyGithubPrWebhook,
  claimWebhookDelivery,
  upsertOutcomeOnPrCreated,
} from "./service";

const baseRow = {
  id: "out-1",
  userId: "user-1",
  repoId: "repo-1",
  jobId: "job-1",
  issueNumber: 7,
  prNumber: 42,
  prUrl: "https://github.com/acme/demo/pull/42",
  state: "OPEN" as const,
  openedAt: new Date("2026-10-08T10:00:00.000Z"),
  mergedAt: null,
  closedAt: null,
  changesRequestedAt: null,
  lastObservedAt: new Date("2026-10-08T10:00:00.000Z"),
  githubUpdatedAt: new Date("2026-10-08T10:00:00.000Z"),
  createdAt: new Date("2026-10-08T10:00:00.000Z"),
  updatedAt: new Date("2026-10-08T10:00:00.000Z"),
};

describe("upsertOutcomeOnPrCreated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("associates ResolveJob with PR via upsert on jobId", async () => {
    upsert.mockResolvedValue(baseRow);

    const row = await upsertOutcomeOnPrCreated({
      userId: "user-1",
      repoId: "repo-1",
      jobId: "job-1",
      issueNumber: 7,
      prNumber: 42,
      prUrl: "https://github.com/acme/demo/pull/42",
    });

    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0].where).toEqual({ jobId: "job-1" });
    expect(row.prNumber).toBe(42);
    expect(row.jobId).toBe("job-1");
  });

  it("retry upsert does not create a second row (same jobId)", async () => {
    upsert.mockResolvedValue(baseRow);
    await upsertOutcomeOnPrCreated({
      userId: "user-1",
      repoId: "repo-1",
      jobId: "job-1",
      issueNumber: 7,
      prNumber: 42,
      prUrl: "https://github.com/acme/demo/pull/42",
    });
    await upsertOutcomeOnPrCreated({
      userId: "user-1",
      repoId: "repo-1",
      jobId: "job-1",
      issueNumber: 7,
      prNumber: 42,
      prUrl: "https://github.com/acme/demo/pull/42",
    });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls.every((c) => c[0].where.jobId === "job-1")).toBe(
      true,
    );
  });
});

describe("claimWebhookDelivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true on first delivery", async () => {
    createDelivery.mockResolvedValue({ id: "d1" });
    await expect(
      claimWebhookDelivery({
        deliveryId: "del-1",
        event: "pull_request",
        action: "closed",
        repoId: "repo-1",
      }),
    ).resolves.toBe(true);
  });

  it("returns false on duplicate delivery", async () => {
    createDelivery.mockRejectedValue(
      new Error(
        "Unique constraint failed on the fields: (`deliveryId`) WebhookDelivery_deliveryId",
      ),
    );
    await expect(
      claimWebhookDelivery({
        deliveryId: "del-1",
        event: "pull_request",
        action: "closed",
        repoId: "repo-1",
      }),
    ).resolves.toBe(false);
  });
});

describe("applyGithubPrWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unknown_pr safely when no outcome row exists", async () => {
    findUnique.mockResolvedValue(null);
    const result = await applyGithubPrWebhook({
      repoId: "repo-1",
      event: "pull_request",
      action: "closed",
      prNumber: 99,
      merged: true,
      prState: "closed",
      githubUpdatedAt: new Date("2026-10-08T12:00:00.000Z"),
    });
    expect(result.status).toBe("unknown_pr");
    expect(update).not.toHaveBeenCalled();
  });

  it("ignores stale events", async () => {
    findUnique.mockResolvedValue(baseRow);
    const result = await applyGithubPrWebhook({
      repoId: "repo-1",
      event: "pull_request",
      action: "synchronize",
      prNumber: 42,
      prState: "open",
      githubUpdatedAt: new Date("2026-10-08T09:00:00.000Z"),
    });
    expect(result).toEqual({ status: "ignored", reason: "stale" });
    expect(update).not.toHaveBeenCalled();
  });

  it("does not regress MERGED to OPEN from an older event", async () => {
    findUnique.mockResolvedValue({
      ...baseRow,
      state: "MERGED",
      mergedAt: new Date("2026-10-08T11:00:00.000Z"),
      githubUpdatedAt: new Date("2026-10-08T11:00:00.000Z"),
    });
    const result = await applyGithubPrWebhook({
      repoId: "repo-1",
      event: "pull_request",
      action: "reopened",
      prNumber: 42,
      prState: "open",
      githubUpdatedAt: new Date("2026-10-08T12:00:00.000Z"),
    });
    expect(result).toEqual({ status: "ignored", reason: "merged_terminal" });
    expect(update).not.toHaveBeenCalled();
  });

  it("applies MERGED from closed+merged", async () => {
    findUnique.mockResolvedValue(baseRow);
    update.mockResolvedValue({
      ...baseRow,
      state: "MERGED",
      mergedAt: new Date("2026-10-08T12:00:00.000Z"),
      closedAt: new Date("2026-10-08T12:00:00.000Z"),
      githubUpdatedAt: new Date("2026-10-08T12:00:00.000Z"),
    });

    const result = await applyGithubPrWebhook({
      repoId: "repo-1",
      event: "pull_request",
      action: "closed",
      prNumber: 42,
      merged: true,
      prState: "closed",
      githubUpdatedAt: new Date("2026-10-08T12:00:00.000Z"),
    });

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(result.view.state).toBe("MERGED");
    }
  });

  it("applies CHANGES_REQUESTED from review", async () => {
    findUnique.mockResolvedValue(baseRow);
    update.mockResolvedValue({
      ...baseRow,
      state: "CHANGES_REQUESTED",
      changesRequestedAt: new Date("2026-10-08T12:00:00.000Z"),
      githubUpdatedAt: new Date("2026-10-08T12:00:00.000Z"),
    });

    const result = await applyGithubPrWebhook({
      repoId: "repo-1",
      event: "pull_request_review",
      action: "submitted",
      prNumber: 42,
      prState: "open",
      reviewState: "changes_requested",
      githubUpdatedAt: new Date("2026-10-08T12:00:00.000Z"),
    });

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(result.view.state).toBe("CHANGES_REQUESTED");
    }
  });

  it("reopens CLOSED_UNMERGED to OPEN", async () => {
    findUnique.mockResolvedValue({
      ...baseRow,
      state: "CLOSED_UNMERGED",
      closedAt: new Date("2026-10-08T11:00:00.000Z"),
    });
    update.mockResolvedValue({
      ...baseRow,
      state: "OPEN",
      closedAt: null,
      githubUpdatedAt: new Date("2026-10-08T12:00:00.000Z"),
    });

    const result = await applyGithubPrWebhook({
      repoId: "repo-1",
      event: "pull_request",
      action: "reopened",
      prNumber: 42,
      prState: "open",
      githubUpdatedAt: new Date("2026-10-08T12:00:00.000Z"),
    });

    expect(result.status).toBe("applied");
    if (result.status === "applied") {
      expect(result.view.state).toBe("OPEN");
    }
  });
});
