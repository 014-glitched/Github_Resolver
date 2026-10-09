export type TriageEffort = "S" | "M" | "L";
export type TriageRisk = "low" | "medium" | "high";

export type LabelCategory =
  | "bug"
  | "feature"
  | "documentation"
  | "security"
  | "other"
  | "none";

export type TriageMapIssueInput = {
  number: number;
  title: string;
  labels: string[];
  createdAt: string;
  triage: {
    confidence: number;
    effort: TriageEffort;
    risk: TriageRisk;
    reason: string;
    stale: boolean;
    errorMsg: string | null;
  } | null;
};

export type IssueFilterState = {
  efforts: TriageEffort[];
  risks: TriageRisk[];
  labelQuery: string;
  minConfidence: number;
};

export type PlotPoint = {
  issueNumber: number;
  title: string;
  x: number;
  y: number;
  radius: number;
  ageDays: number;
  confidence: number;
  effort: TriageEffort;
  risk: TriageRisk;
  reason: string;
  labels: string[];
  labelCategory: LabelCategory;
  stale: boolean;
};

const EFFORT_X: Record<TriageEffort, number> = {
  S: 0.2,
  M: 0.5,
  L: 0.8,
};

const MIN_RADIUS = 6;
const MAX_RADIUS = 22;
const RADIUS_SCALE = 3.2;

/** Effort → normalized X in [0, 1], with small jitter to reduce overlap. */
export function effortToX(effort: TriageEffort, issueNumber: number): number {
  const base = EFFORT_X[effort];
  const jitter = ((issueNumber % 7) - 3) * 0.01;
  return clamp(base + jitter, 0.05, 0.95);
}

/** Confidence 0–100 → normalized Y in [0, 1] (no distortion). */
export function confidenceToY(confidence: number): number {
  return clamp(confidence / 100, 0, 1);
}

export function ageDaysFromCreatedAt(
  createdAt: string,
  now: Date = new Date(),
): number {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, (now.getTime() - created) / (1000 * 60 * 60 * 24));
}

/** Bounded log-scaled bubble radius from age in days. */
export function ageToRadius(ageDays: number): number {
  const r = MIN_RADIUS + Math.log1p(Math.max(0, ageDays)) * RADIUS_SCALE;
  return clamp(r, MIN_RADIUS, MAX_RADIUS);
}

export function formatAgeDays(ageDays: number): string {
  if (ageDays < 1) return "<1 day";
  if (ageDays < 2) return "1 day";
  if (ageDays < 30) return `${Math.floor(ageDays)} days`;
  if (ageDays < 60) return "1 month";
  const months = Math.floor(ageDays / 30);
  if (months < 12) return `${months} months`;
  const years = Math.floor(ageDays / 365);
  return years === 1 ? "1 year" : `${years} years`;
}

export function labelCategoryFromLabels(labels: string[]): LabelCategory {
  if (!labels.length) return "none";
  const normalized = labels.map((l) => l.toLowerCase().trim());

  const match = (pred: (label: string) => boolean) =>
    normalized.some(pred);

  // Priority across all labels (not first-label-wins)
  if (match((l) => l.includes("security") || l.includes("vuln"))) {
    return "security";
  }
  if (match((l) => l.includes("bug") || l.includes("defect"))) {
    return "bug";
  }
  if (
    match(
      (l) =>
        l.includes("doc") || l === "documentation" || l.includes("readme"),
    )
  ) {
    return "documentation";
  }
  if (
    match(
      (l) =>
        l.includes("feature") ||
        l.includes("enhancement") ||
        l.includes("feat"),
    )
  ) {
    return "feature";
  }
  return "other";
}

/** Deterministic fill tokens (CSS variable-friendly class keys). */
export function labelCategoryFillClass(category: LabelCategory): string {
  switch (category) {
    case "bug":
      return "fill-red-500/70";
    case "feature":
      return "fill-sky-500/70";
    case "documentation":
      return "fill-emerald-500/70";
    case "security":
      return "fill-violet-500/70";
    case "other":
      return "fill-slate-500/60";
    case "none":
      return "fill-muted-foreground/50";
  }
}

export function riskStrokeClass(risk: TriageRisk): string {
  switch (risk) {
    case "high":
      return "stroke-destructive";
    case "medium":
      return "stroke-amber-500";
    case "low":
      return "stroke-muted-foreground/60";
  }
}

export function riskStrokeWidth(risk: TriageRisk): number {
  return risk === "high" ? 2.5 : risk === "medium" ? 2 : 1.25;
}

export function defaultIssueFilters(): IssueFilterState {
  return {
    efforts: [],
    risks: [],
    labelQuery: "",
    minConfidence: 0,
  };
}

export function matchesIssueFilters(
  issue: TriageMapIssueInput,
  filters: IssueFilterState,
): boolean {
  const { efforts, risks, labelQuery, minConfidence } = filters;

  if (efforts.length > 0) {
    if (!issue.triage || !efforts.includes(issue.triage.effort)) return false;
  }
  if (risks.length > 0) {
    if (!issue.triage || !risks.includes(issue.triage.risk)) return false;
  }
  if (minConfidence > 0) {
    if (!issue.triage || issue.triage.confidence < minConfidence) return false;
  }
  const q = labelQuery.trim().toLowerCase();
  if (q) {
    const hit = issue.labels.some((l) => l.toLowerCase().includes(q));
    if (!hit) return false;
  }
  return true;
}

/**
 * Build plottable points. Missing triage and failed triage (errorMsg) excluded.
 * Stale scores are included (caller styles them).
 */
export function toPlotPoints(
  issues: TriageMapIssueInput[],
  now: Date = new Date(),
): PlotPoint[] {
  const points: PlotPoint[] = [];

  for (const issue of issues) {
    const t = issue.triage;
    if (!t) continue;
    if (t.errorMsg) continue;

    const ageDays = ageDaysFromCreatedAt(issue.createdAt, now);
    points.push({
      issueNumber: issue.number,
      title: issue.title,
      x: effortToX(t.effort, issue.number),
      y: confidenceToY(t.confidence),
      radius: ageToRadius(ageDays),
      ageDays,
      confidence: t.confidence,
      effort: t.effort,
      risk: t.risk,
      reason: t.reason,
      labels: issue.labels,
      labelCategory: labelCategoryFromLabels(issue.labels),
      stale: t.stale,
    });
  }

  return points;
}

export function countMissingTriage(issues: TriageMapIssueInput[]): number {
  return issues.filter((i) => !i.triage || Boolean(i.triage.errorMsg)).length;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
