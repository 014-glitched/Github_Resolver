export type TriageErrorCategory =
  | "parse"
  | "github"
  | "anthropic"
  | "db"
  | "validation"
  | "unknown";

export class TriageUserError extends Error {
  readonly category: TriageErrorCategory;
  readonly internalMessage: string;

  constructor(
    userMessage: string,
    category: TriageErrorCategory,
    internalMessage?: string,
  ) {
    super(userMessage);
    this.name = "TriageUserError";
    this.category = category;
    this.internalMessage = internalMessage ?? userMessage;
  }
}

export function categorizeTriageError(err: unknown): TriageErrorCategory {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (
    lower.includes("invalid json") ||
    lower.includes("no json") ||
    lower.includes("no text content") ||
    lower.includes("zod") ||
    lower.includes("triage model returned")
  ) {
    return "parse";
  }
  if (
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("anthropic") ||
    lower.includes("overloaded") ||
    lower.includes("timeout")
  ) {
    return "anthropic";
  }
  if (
    lower.includes("github") ||
    lower.includes("octokit") ||
    lower.includes("not found") ||
    lower.includes("pull request")
  ) {
    return "github";
  }
  if (
    lower.includes("prisma") ||
    lower.includes("database") ||
    lower.includes("p1001") ||
    lower.includes("unique constraint")
  ) {
    return "db";
  }
  return "unknown";
}

export function toUserFacingTriageError(err: unknown): TriageUserError {
  if (err instanceof TriageUserError) return err;

  const internal = err instanceof Error ? err.message : String(err);
  const category = categorizeTriageError(err);

  switch (category) {
    case "anthropic":
      return new TriageUserError(
        "AI analysis is temporarily unavailable. Please try again.",
        category,
        internal,
      );
    case "github":
      return new TriageUserError(
        "Could not load this GitHub issue for analysis. Please try again.",
        category,
        internal,
      );
    case "parse":
      return new TriageUserError(
        "AI returned an invalid analysis. Please retry triage.",
        category,
        internal,
      );
    case "db":
      return new TriageUserError(
        "Could not save triage results. Please try again.",
        category,
        internal,
      );
    default:
      return new TriageUserError(
        "Triage failed unexpectedly. Please try again.",
        category,
        internal,
      );
  }
}
