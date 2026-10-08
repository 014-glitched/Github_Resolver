import { describe, expect, it } from "vitest";

import {
  categorizeTriageError,
  toUserFacingTriageError,
  TriageUserError,
} from "./errors";

describe("toUserFacingTriageError", () => {
  it("maps anthropic/rate-limit failures to a safe user message", () => {
    const err = toUserFacingTriageError(new Error("Anthropic: rate limit 429"));
    expect(err).toBeInstanceOf(TriageUserError);
    expect(err.category).toBe("anthropic");
    expect(err.message).toBe(
      "AI analysis is temporarily unavailable. Please try again.",
    );
    expect(err.internalMessage).toContain("rate limit");
  });

  it("maps parse failures without inventing a confidence score", () => {
    const err = toUserFacingTriageError(
      new Error("Triage model returned no JSON object"),
    );
    expect(err.category).toBe("parse");
    expect(err.message).toBe(
      "AI returned an invalid analysis. Please retry triage.",
    );
    expect(err.message).not.toMatch(/50/);
  });

  it("categorizes github and db errors", () => {
    expect(categorizeTriageError(new Error("GitHub: Not Found"))).toBe(
      "github",
    );
    expect(categorizeTriageError(new Error("Prisma P1001"))).toBe("db");
  });
});
