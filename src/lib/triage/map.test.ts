import { describe, expect, it } from "vitest";

import {
  ageToRadius,
  confidenceToY,
  countMissingTriage,
  defaultIssueFilters,
  effortToX,
  labelCategoryFromLabels,
  matchesIssueFilters,
  riskStrokeClass,
  toPlotPoints,
  type TriageMapIssueInput,
} from "./map";

function issue(
  overrides: Partial<TriageMapIssueInput> & { number: number },
): TriageMapIssueInput {
  return {
    title: `Issue ${overrides.number}`,
    labels: [],
    createdAt: "2026-10-01T00:00:00.000Z",
    triage: {
      confidence: 70,
      effort: "M",
      risk: "low",
      reason: "ok",
      stale: false,
      errorMsg: null,
    },
    ...overrides,
  };
}

describe("effortToX / confidenceToY", () => {
  it("maps effort S/M/L to distinct X bands", () => {
    expect(effortToX("S", 1)).toBeLessThan(0.4);
    expect(effortToX("M", 1)).toBeGreaterThan(0.4);
    expect(effortToX("M", 1)).toBeLessThan(0.7);
    expect(effortToX("L", 1)).toBeGreaterThan(0.7);
  });

  it("maps confidence linearly without distortion", () => {
    expect(confidenceToY(0)).toBe(0);
    expect(confidenceToY(50)).toBe(0.5);
    expect(confidenceToY(100)).toBe(1);
  });
});

describe("ageToRadius", () => {
  it("keeps tiny and huge ages within bounds", () => {
    const young = ageToRadius(0);
    const ancient = ageToRadius(3650);
    expect(young).toBeGreaterThanOrEqual(6);
    expect(young).toBeLessThan(ancient);
    expect(ancient).toBeLessThanOrEqual(22);
  });
});

describe("labelCategoryFromLabels", () => {
  it("picks known categories and handles none/unknown", () => {
    expect(labelCategoryFromLabels([])).toBe("none");
    expect(labelCategoryFromLabels(["bug"])).toBe("bug");
    expect(labelCategoryFromLabels(["enhancement", "bug"])).toBe("bug");
    expect(labelCategoryFromLabels(["docs"])).toBe("documentation");
    expect(labelCategoryFromLabels(["security"])).toBe("security");
    expect(labelCategoryFromLabels(["feature"])).toBe("feature");
    expect(labelCategoryFromLabels(["chore"])).toBe("other");
  });
});

describe("riskStrokeClass", () => {
  it("gives high risk a destructive stroke", () => {
    expect(riskStrokeClass("high")).toContain("destructive");
    expect(riskStrokeClass("low")).not.toContain("destructive");
  });
});

describe("matchesIssueFilters", () => {
  it("filters by effort, risk, label, and min confidence", () => {
    const base = issue({
      number: 1,
      labels: ["bug"],
      triage: {
        confidence: 80,
        effort: "S",
        risk: "high",
        reason: "r",
        stale: false,
        errorMsg: null,
      },
    });

    expect(
      matchesIssueFilters(base, {
        ...defaultIssueFilters(),
        efforts: ["S"],
      }),
    ).toBe(true);
    expect(
      matchesIssueFilters(base, {
        ...defaultIssueFilters(),
        efforts: ["L"],
      }),
    ).toBe(false);
    expect(
      matchesIssueFilters(base, {
        ...defaultIssueFilters(),
        risks: ["high"],
      }),
    ).toBe(true);
    expect(
      matchesIssueFilters(base, {
        ...defaultIssueFilters(),
        minConfidence: 90,
      }),
    ).toBe(false);
    expect(
      matchesIssueFilters(base, {
        ...defaultIssueFilters(),
        labelQuery: "bug",
      }),
    ).toBe(true);
    expect(
      matchesIssueFilters(base, {
        ...defaultIssueFilters(),
        labelQuery: "docs",
      }),
    ).toBe(false);
  });
});

describe("toPlotPoints / missing triage", () => {
  it("excludes missing and failed triage; includes stale", () => {
    const points = toPlotPoints(
      [
        issue({ number: 1 }),
        issue({ number: 2, triage: null }),
        issue({
          number: 3,
          triage: {
            confidence: 40,
            effort: "L",
            risk: "medium",
            reason: "fail",
            stale: false,
            errorMsg: "parse error",
          },
        }),
        issue({
          number: 4,
          triage: {
            confidence: 90,
            effort: "S",
            risk: "low",
            reason: "old",
            stale: true,
            errorMsg: null,
          },
        }),
      ],
      new Date("2026-10-08T00:00:00.000Z"),
    );

    expect(points.map((p) => p.issueNumber).sort()).toEqual([1, 4]);
    expect(points.find((p) => p.issueNumber === 4)?.stale).toBe(true);
    expect(countMissingTriage([
      issue({ number: 1 }),
      issue({ number: 2, triage: null }),
      issue({
        number: 3,
        triage: {
          confidence: 10,
          effort: "S",
          risk: "low",
          reason: "x",
          stale: false,
          errorMsg: "err",
        },
      }),
    ])).toBe(2);
  });
});
