import type { PrOutcomeView } from "./schema";

/** Row shape from Prisma PrOutcome — inferred-friendly minimal fields */
export type PrOutcomeRow = {
  id?: string;
  jobId: string;
  state: "OPEN" | "MERGED" | "CLOSED_UNMERGED" | "CHANGES_REQUESTED";
  prNumber: number;
  prUrl: string;
  openedAt: Date | null;
  mergedAt: Date | null;
  closedAt: Date | null;
  changesRequestedAt: Date | null;
  lastObservedAt: Date;
  githubUpdatedAt: Date | null;
};

function toIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export function toPrOutcomeView(row: PrOutcomeRow): PrOutcomeView {
  return {
    state: row.state,
    prNumber: row.prNumber,
    prUrl: row.prUrl,
    openedAt: toIso(row.openedAt),
    mergedAt: toIso(row.mergedAt),
    closedAt: toIso(row.closedAt),
    changesRequestedAt: toIso(row.changesRequestedAt),
    lastObservedAt: row.lastObservedAt.toISOString(),
    githubUpdatedAt: toIso(row.githubUpdatedAt),
  };
}
