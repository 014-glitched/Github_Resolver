import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findUnique,
  upsert,
  update,
  issuesGet,
  listComments,
  messagesCreate,
} = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  issuesGet: vi.fn(),
  listComments: vi.fn(),
  messagesCreate: vi.fn(),
}));

vi.mock("@/src/lib/prisma", () => ({
  default: {
    issueTriage: {
      findUnique,
      upsert,
      update,
    },
  },
}));

vi.mock("octokit", () => ({
  Octokit: class Octokit {
    rest = {
      issues: {
        get: issuesGet,
        listComments,
      },
    };
  },
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class Anthropic {
    messages = {
      create: messagesCreate,
    };
  },
}));

import { TriageUserError } from "./errors";
import { triageIssue } from "./service";

const cachedRow = {
  id: "triage-1",
  userId: "user-1",
  repoId: "repo-1",
  issueNumber: 7,
  issueUpdatedAt: new Date("2026-10-01T12:00:00.000Z"),
  confidence: 81,
  effort: "S",
  risk: "low",
  reason: "Cached typo fix",
  model: "claude-sonnet-4-20250514",
  promptVersion: "triage-issue.v1",
  provider: "anthropic",
  errorMsg: null,
  createdAt: new Date("2026-10-01T12:05:00.000Z"),
  updatedAt: new Date("2026-10-01T12:05:00.000Z"),
};

const baseInput = {
  userId: "user-1",
  repoId: "repo-1",
  repoFullName: "acme/demo",
  accessToken: "token",
  issueNumber: 7,
};

describe("triageIssue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    issuesGet.mockResolvedValue({
      data: {
        title: "Fix typo",
        body: "Change colour to color",
        updated_at: "2026-10-01T12:00:00.000Z",
        labels: [],
        pull_request: undefined,
      },
    });
    listComments.mockResolvedValue({ data: [] });
  });

  it("reuses cache when issueUpdatedAt is unchanged", async () => {
    findUnique.mockResolvedValue(cachedRow);

    const view = await triageIssue(baseInput);

    expect(view.confidence).toBe(81);
    expect(view.stale).toBe(false);
    expect(messagesCreate).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(listComments).not.toHaveBeenCalled();
  });

  it("regenerates when github updated_at is newer than cache", async () => {
    const staleCache = {
      ...cachedRow,
      issueUpdatedAt: new Date("2026-09-01T00:00:00.000Z"),
    };
    findUnique
      .mockResolvedValueOnce(staleCache)
      .mockResolvedValueOnce(staleCache);

    issuesGet.mockResolvedValue({
      data: {
        title: "Fix typo",
        body: "Updated body",
        updated_at: "2026-10-01T12:00:00.000Z",
        labels: [],
        pull_request: undefined,
      },
    });

    messagesCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            confidence: 90,
            effort: "S",
            risk: "low",
            reason: "Still a typo",
          }),
        },
      ],
    });

    const saved = {
      ...cachedRow,
      confidence: 90,
      reason: "Still a typo",
      issueUpdatedAt: new Date("2026-10-01T12:00:00.000Z"),
    };
    upsert.mockResolvedValue(saved);

    const view = await triageIssue(baseInput);

    expect(messagesCreate).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(view.confidence).toBe(90);
    expect(view.stale).toBe(false);
  });

  it("throws a safe user error on parse failure and does not invent confidence=50", async () => {
    findUnique.mockResolvedValue(null);
    messagesCreate.mockResolvedValue({
      content: [{ type: "text", text: "I cannot do JSON today" }],
    });

    await expect(triageIssue(baseInput)).rejects.toBeInstanceOf(TriageUserError);
    await expect(triageIssue(baseInput)).rejects.toMatchObject({
      message: "AI returned an invalid analysis. Please retry triage.",
      category: "parse",
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("maps anthropic failures to a safe unavailable message", async () => {
    findUnique.mockResolvedValue(null);
    messagesCreate.mockRejectedValue(new Error("rate limit 429"));

    await expect(triageIssue(baseInput)).rejects.toMatchObject({
      message: "AI analysis is temporarily unavailable. Please try again.",
      category: "anthropic",
    });
  });
});
