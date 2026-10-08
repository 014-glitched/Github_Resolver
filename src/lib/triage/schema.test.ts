import { describe, expect, it } from "vitest";

import { parseTriageModelOutput, triageResultSchema } from "./schema";

describe("triageResultSchema", () => {
  it("accepts valid output", () => {
    const result = triageResultSchema.parse({
      confidence: 72,
      effort: "M",
      risk: "low",
      reason: "Clear bug with a localized fix path",
    });
    expect(result.confidence).toBe(72);
    expect(result.effort).toBe("M");
    expect(result.risk).toBe("low");
  });

  it("rejects confidence out of range", () => {
    expect(() =>
      triageResultSchema.parse({
        confidence: 150,
        effort: "S",
        risk: "low",
        reason: "too high",
      }),
    ).toThrow();

    expect(() =>
      triageResultSchema.parse({
        confidence: -1,
        effort: "S",
        risk: "low",
        reason: "too low",
      }),
    ).toThrow();
  });

  it("rejects invalid effort", () => {
    expect(() =>
      triageResultSchema.parse({
        confidence: 50,
        effort: "XL",
        risk: "low",
        reason: "bad effort",
      }),
    ).toThrow();
  });

  it("rejects invalid risk", () => {
    expect(() =>
      triageResultSchema.parse({
        confidence: 50,
        effort: "S",
        risk: "critical",
        reason: "bad risk",
      }),
    ).toThrow();
  });

  it("rejects missing reason", () => {
    expect(() =>
      triageResultSchema.parse({
        confidence: 50,
        effort: "S",
        risk: "low",
        reason: "",
      }),
    ).toThrow();

    expect(() =>
      triageResultSchema.parse({
        confidence: 50,
        effort: "S",
        risk: "low",
      }),
    ).toThrow();
  });
});

describe("parseTriageModelOutput", () => {
  it("parses JSON from model text", () => {
    const result = parseTriageModelOutput(
      'Here you go: {"confidence":80,"effort":"S","risk":"low","reason":"typo fix"}',
    );
    expect(result).toEqual({
      confidence: 80,
      effort: "S",
      risk: "low",
      reason: "typo fix",
    });
  });

  it("does not invent confidence=50 on parse failure", () => {
    expect(() => parseTriageModelOutput("not json at all")).toThrow(
      /no JSON object/i,
    );
    expect(() => parseTriageModelOutput("{bad}")).toThrow(/invalid JSON/i);
    expect(() =>
      parseTriageModelOutput(
        '{"confidence":50,"effort":"S","risk":"low","reason":""}',
      ),
    ).toThrow();
  });
});
