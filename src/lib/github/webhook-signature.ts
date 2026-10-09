import * as crypto from "crypto";

/**
 * Verifies that the incoming webhook payload was sent by GitHub
 * by comparing the HMAC SHA-256 signature against our webhook secret.
 */
export function verifyGithubSignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = "sha256=" + hmac.update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}
