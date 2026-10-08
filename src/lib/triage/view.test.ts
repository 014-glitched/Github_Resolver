import { describe, expect, it } from "vitest";

import { toTriageView, type IssueTriageRow } from "./view";

function makeRow(overrides: Partial<IssueTriageRow> = {}): IssueTriageRow {
  return {
    id: "triage-1",
    userId: "user-1",
    repoId: "repo-1",
    issueNumber: 42,
    issueUpdatedAt: new Date("2026-10-01T12:00:00.000Z"),
    confidence: 70,
    effort: "M",
    risk: "medium",
    reason: "Localized UI bug",
    model: "claude-sonnet-4-20250514",
    promptVersion: "triage-issue.v1",
    provider: "anthropic",
    errorMsg: null,
    createdAt: new Date("2026-10-01T12:05:00.000Z"),
    updatedAt: new Date("2026-10-01T12:05:00.000Z"),
    ...overrides,
  } as IssueTriageRow;
}

describe("toTriageView", () => {
  it("marks triage fresh when github updated_at is unchanged", () => {
    const row = makeRow();
    const view = toTriageView(row, new Date("2026-10-01T12:00:00.000Z"));
    expect(view.stale).toBe(false);
    expect(view.confidence).toBe(70);
  });

  it("marks triage stale when github updated_at is newer", () => {
    const row = makeRow();
    const view = toTriageView(row, new Date("2026-10-02T08:00:00.000Z"));
    expect(view.stale).toBe(true);
  });
});
