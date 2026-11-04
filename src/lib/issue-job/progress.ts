export type IssueJobStatus =
  | "QUEUED"
  | "FETCHING_CONTEXT"
  | "ANALYZING"
  | "VERIFYING"
  | "CREATING_PR"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type JobStepState = "done" | "active" | "pending" | "failed";

export type JobCardState = "idle" | "resolving" | "resolved" | "failed";

/** Pipeline stages shown in the progress tracker (excludes terminal COMPLETED). */
export const ISSUE_JOB_STEPS: { key: IssueJobStatus; label: string }[] = [
  { key: "QUEUED", label: "Queued — waiting for worker" },
  { key: "FETCHING_CONTEXT", label: "Fetching issue and repository context" },
  { key: "ANALYZING", label: "Generating a proposed fix" },
  { key: "VERIFYING", label: "Reviewing the proposed fix" },
  { key: "CREATING_PR", label: "Creating branch, commit, and pull request" },
];

const PIPELINE_ORDER: IssueJobStatus[] = [
  "QUEUED",
  "FETCHING_CONTEXT",
  "ANALYZING",
  "VERIFYING",
  "CREATING_PR",
  "COMPLETED",
];

/** Informational UI threshold only — never auto-fail a job. */
export const LONG_RUNNING_MS = 5 * 60 * 1000;

export function isTerminalJobStatus(status: IssueJobStatus): boolean {
  return (
    status === "COMPLETED" || status === "FAILED" || status === "CANCELLED"
  );
}

export function isActiveJobStatus(status: IssueJobStatus): boolean {
  return !isTerminalJobStatus(status);
}

export function getJobCardState(
  job: { status: IssueJobStatus } | null,
): JobCardState {
  if (!job) return "idle";
  if (job.status === "COMPLETED") return "resolved";
  if (job.status === "FAILED" || job.status === "CANCELLED") return "failed";
  return "resolving";
}

/**
 * Map a pipeline step against the job's current status.
 *
 * FAILED/CANCELLED: we do not persist which stage failed, so steps stay
 * pending and the UI relies on the error banner (honest, no invented stage).
 */
export function getStepState(
  stepKey: IssueJobStatus,
  currentStatus: IssueJobStatus,
): JobStepState {
  const stepIndex = PIPELINE_ORDER.indexOf(stepKey);
  if (stepIndex < 0) return "pending";

  if (currentStatus === "COMPLETED") return "done";

  if (currentStatus === "FAILED" || currentStatus === "CANCELLED") {
    return "pending";
  }

  const currentIndex = PIPELINE_ORDER.indexOf(currentStatus);
  if (currentIndex < 0) return "pending";
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "active";
  return "pending";
}

export function statusBadgeLabel(status: IssueJobStatus): string {
  switch (status) {
    case "QUEUED":
      return "Queued";
    case "FETCHING_CONTEXT":
      return "Fetching";
    case "ANALYZING":
      return "Analyzing";
    case "VERIFYING":
      return "Verifying";
    case "CREATING_PR":
      return "Creating PR";
    case "COMPLETED":
      return "Resolved";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
  }
}

export function statusProgressMessage(status: IssueJobStatus): string {
  const step = ISSUE_JOB_STEPS.find((s) => s.key === status);
  if (step) return step.label;
  if (status === "COMPLETED") return "Completed";
  if (status === "FAILED") return "Job failed";
  if (status === "CANCELLED") return "Job cancelled";
  return status;
}

export function formatElapsed(
  startedAt: string | Date | null | undefined,
  endedAt: string | Date | null | undefined = null,
  now: Date = new Date(),
): string | null {
  if (!startedAt) return null;
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return null;
  const end = endedAt ? new Date(endedAt).getTime() : now.getTime();
  if (Number.isNaN(end) || end < start) return null;

  const seconds = Math.floor((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (minutes < 60) return rem === 0 ? `${minutes}m` : `${minutes}m ${rem}s`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  return remMin === 0 ? `${hours}h` : `${hours}h ${remMin}m`;
}

export function isLongRunning(
  startedAt: string | Date | null | undefined,
  status: IssueJobStatus,
  now: Date = new Date(),
): boolean {
  if (!isActiveJobStatus(status) || !startedAt) return false;
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return false;
  return now.getTime() - start >= LONG_RUNNING_MS;
}

export function hasActiveJobs(
  jobs: Array<{ status: IssueJobStatus } | null | undefined>,
): boolean {
  return jobs.some((j) => j && isActiveJobStatus(j.status));
}
