import prisma from "@/src/lib/prisma";

/** Row shape from Prisma IssueTriage — inferred so we don't depend on generated type exports */
export type IssueTriageRow = Awaited<
  ReturnType<typeof prisma.issueTriage.findMany>
>[number];

export type TriageView = {
  issueNumber?: number;
  confidence: number;
  effort: "S" | "M" | "L";
  risk: "low" | "medium" | "high";
  reason: string;
  issueUpdatedAt: string;
  stale: boolean;
  model: string;
  promptVersion: string;
  provider: string;
  createdAt: string;
  errorMsg: string | null;
};

export function toTriageView(
  row: IssueTriageRow,
  githubUpdatedAt: Date | string,
): TriageView {
  const ghUpdated =
    typeof githubUpdatedAt === "string"
      ? new Date(githubUpdatedAt)
      : githubUpdatedAt;
  const stale = ghUpdated.getTime() > row.issueUpdatedAt.getTime();

  return {
    issueNumber: row.issueNumber,
    confidence: row.confidence,
    effort: row.effort,
    risk: row.risk,
    reason: row.reason,
    issueUpdatedAt: row.issueUpdatedAt.toISOString(),
    stale,
    model: row.model,
    promptVersion: row.promptVersion,
    provider: row.provider,
    createdAt: row.createdAt.toISOString(),
    errorMsg: row.errorMsg,
  };
}

export async function getTriagesForRepo(
  repoId: string,
): Promise<Map<number, IssueTriageRow>> {
  const rows = await prisma.issueTriage.findMany({ where: { repoId } });
  return new Map(rows.map((row) => [row.issueNumber, row]));
}
