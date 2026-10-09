import { describe, expect, it } from "vitest";

import {
  isStaleGithubUpdate,
  mapPullRequestAction,
  mapPullRequestReviewAction,
  shouldApplyDesiredState,
} from "./state";

describe("mapPullRequestAction", () => {
  it("maps opened to OPEN", () => {
    expect(
      mapPullRequestAction({
        action: "opened",
        merged: false,
        prState: "open",
      })?.state,
    ).toBe("OPEN");
  });

  it("maps closed+merged to MERGED", () => {
    expect(
      mapPullRequestAction({
        action: "closed",
        merged: true,
        prState: "closed",
      })?.state,
    ).toBe("MERGED");
  });

  it("maps closed without merge to CLOSED_UNMERGED", () => {
    expect(
      mapPullRequestAction({
        action: "closed",
        merged: false,
        prState: "closed",
      })?.state,
    ).toBe("CLOSED_UNMERGED");
  });

  it("maps reopened to OPEN", () => {
    expect(
      mapPullRequestAction({
        action: "reopened",
        merged: false,
        prState: "open",
      })?.state,
    ).toBe("OPEN");
  });
});

describe("mapPullRequestReviewAction", () => {
  it("maps changes_requested review to CHANGES_REQUESTED", () => {
    expect(
      mapPullRequestReviewAction({
        action: "submitted",
        reviewState: "changes_requested",
        prState: "open",
      })?.state,
    ).toBe("CHANGES_REQUESTED");
  });

  it("ignores approved reviews", () => {
    expect(
      mapPullRequestReviewAction({
        action: "submitted",
        reviewState: "approved",
        prState: "open",
      }),
    ).toBeNull();
  });
});

describe("ordering and terminal rules", () => {
  it("detects stale githubUpdatedAt", () => {
    expect(
      isStaleGithubUpdate(
        new Date("2026-10-08T12:00:00.000Z"),
        new Date("2026-10-08T11:00:00.000Z"),
      ),
    ).toBe(true);
    expect(
      isStaleGithubUpdate(
        new Date("2026-10-08T12:00:00.000Z"),
        new Date("2026-10-08T13:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("does not allow MERGED to regress", () => {
    expect(shouldApplyDesiredState("MERGED", "OPEN")).toBe(false);
    expect(shouldApplyDesiredState("MERGED", "CHANGES_REQUESTED")).toBe(false);
    expect(shouldApplyDesiredState("OPEN", "MERGED")).toBe(true);
  });
});
