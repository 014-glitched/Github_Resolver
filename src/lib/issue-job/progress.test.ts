import { describe, expect, it } from "vitest";

import {
  formatElapsed,
  getJobCardState,
  getStepState,
  hasActiveJobs,
  isActiveJobStatus,
  isLongRunning,
  isTerminalJobStatus,
  ISSUE_JOB_STEPS,
  statusBadgeLabel,
} from "./progress";

describe("terminal / active helpers", () => {
  it("detects terminal and active statuses", () => {
    expect(isTerminalJobStatus("COMPLETED")).toBe(true);
    expect(isTerminalJobStatus("FAILED")).toBe(true);
    expect(isTerminalJobStatus("CANCELLED")).toBe(true);
    expect(isTerminalJobStatus("ANALYZING")).toBe(false);
    expect(isActiveJobStatus("QUEUED")).toBe(true);
    expect(isActiveJobStatus("COMPLETED")).toBe(false);
  });

  it("hasActiveJobs drives polling shutdown", () => {
    expect(hasActiveJobs([null, { status: "COMPLETED" }])).toBe(false);
    expect(hasActiveJobs([{ status: "VERIFYING" }])).toBe(true);
  });
});

describe("getStepState", () => {
  it("marks QUEUED as active with later steps pending", () => {
    expect(getStepState("QUEUED", "QUEUED")).toBe("active");
    expect(getStepState("FETCHING_CONTEXT", "QUEUED")).toBe("pending");
    expect(getStepState("CREATING_PR", "QUEUED")).toBe("pending");
  });

  it("marks earlier steps done and current active", () => {
    expect(getStepState("QUEUED", "VERIFYING")).toBe("done");
    expect(getStepState("ANALYZING", "VERIFYING")).toBe("done");
    expect(getStepState("VERIFYING", "VERIFYING")).toBe("active");
    expect(getStepState("CREATING_PR", "VERIFYING")).toBe("pending");
  });

  it("marks all pipeline steps done when COMPLETED", () => {
    for (const step of ISSUE_JOB_STEPS) {
      expect(getStepState(step.key, "COMPLETED")).toBe("done");
    }
  });

  it("does not invent a failed stage when status is FAILED", () => {
    for (const step of ISSUE_JOB_STEPS) {
      expect(getStepState(step.key, "FAILED")).toBe("pending");
    }
  });
});

describe("getJobCardState / labels", () => {
  it("maps card states", () => {
    expect(getJobCardState(null)).toBe("idle");
    expect(getJobCardState({ status: "ANALYZING" })).toBe("resolving");
    expect(getJobCardState({ status: "COMPLETED" })).toBe("resolved");
    expect(getJobCardState({ status: "FAILED" })).toBe("failed");
  });

  it("returns badge labels", () => {
    expect(statusBadgeLabel("FETCHING_CONTEXT")).toBe("Fetching");
    expect(statusBadgeLabel("CREATING_PR")).toBe("Creating PR");
  });
});

describe("formatElapsed / isLongRunning", () => {
  it("formats elapsed duration", () => {
    expect(
      formatElapsed(
        "2026-10-09T12:00:00.000Z",
        "2026-10-09T12:00:45.000Z",
      ),
    ).toBe("45s");
    expect(
      formatElapsed(
        "2026-10-09T12:00:00.000Z",
        "2026-10-09T12:02:05.000Z",
      ),
    ).toBe("2m 5s");
    expect(formatElapsed(null)).toBeNull();
  });

  it("flags long-running active jobs only", () => {
    const started = new Date("2026-10-09T12:00:00.000Z");
    const now = new Date("2026-10-09T12:06:00.000Z");
    expect(isLongRunning(started, "ANALYZING", now)).toBe(true);
    expect(isLongRunning(started, "COMPLETED", now)).toBe(false);
    expect(
      isLongRunning(started, "ANALYZING", new Date("2026-10-09T12:01:00.000Z")),
    ).toBe(false);
  });
});
