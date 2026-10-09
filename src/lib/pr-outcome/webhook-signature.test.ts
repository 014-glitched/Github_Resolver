import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyGithubSignature } from "@/src/lib/github/webhook-signature";

describe("verifyGithubSignature", () => {
  it("accepts a valid signature", () => {
    const payload = '{"action":"closed"}';
    const secret = "test-secret";
    const digest =
      "sha256=" +
      createHmac("sha256", secret).update(payload).digest("hex");
    expect(verifyGithubSignature(payload, digest, secret)).toBe(true);
  });

  it("rejects an invalid signature", () => {
    const payload = '{"action":"closed"}';
    expect(
      verifyGithubSignature(
        payload,
        "sha256=0000000000000000000000000000000000000000000000000000000000000000",
        "test-secret",
      ),
    ).toBe(false);
  });
});
