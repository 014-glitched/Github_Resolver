"use client";

import { AlertCircle, Check, CheckCircle2, LoaderCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  formatElapsed,
  getStepState,
  isLongRunning,
  ISSUE_JOB_STEPS,
  statusBadgeLabel,
  statusProgressMessage,
  type IssueJobStatus,
} from "@/src/lib/issue-job/progress";

type JobProgressProps = {
  status: IssueJobStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMsg?: string | null;
  prUrl?: string | null;
  prNumber?: number | null;
  compact?: boolean;
};

export function JobProgress({
  status,
  startedAt,
  completedAt,
  errorMsg,
  prUrl,
  prNumber,
  compact,
}: JobProgressProps) {
  const elapsed = formatElapsed(
    startedAt,
    status === "COMPLETED" || status === "FAILED" || status === "CANCELLED"
      ? completedAt
      : null,
  );
  const longRunning = isLongRunning(startedAt, status);
  const renderSteps = status !== "COMPLETED";

  return (
    <div
      className={
        compact
          ? "space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3"
          : "mt-4 space-y-3 rounded-lg border border-border/60 bg-background/60 p-4"
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={
            status === "FAILED" || status === "CANCELLED"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : status === "COMPLETED"
                ? "border-success/30 bg-success/10 text-success"
                : "border-primary/30 bg-primary/10 text-primary"
          }
        >
          {status !== "COMPLETED" &&
          status !== "FAILED" &&
          status !== "CANCELLED" ? (
            <LoaderCircle className="mr-1 size-3 animate-spin" />
          ) : null}
          {statusBadgeLabel(status)}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {statusProgressMessage(status)}
        </span>
        {elapsed ? (
          <span className="text-xs text-muted-foreground">· {elapsed}</span>
        ) : null}
      </div>

      {longRunning ? (
        <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          Still running longer than expected. The worker may still be active —
          this is not a failure.
        </p>
      ) : null}

      {renderSteps ? (
        <div className="flex flex-col gap-2.5">
          {ISSUE_JOB_STEPS.map((s) => {
            const state = getStepState(s.key, status);
            return (
              <div key={s.key} className="flex items-center gap-3">
                {state === "done" && (
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full border border-success/30 bg-success/10 text-success">
                    <Check className="size-3" />
                  </div>
                )}
                {state === "active" && (
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                    <LoaderCircle className="size-3 animate-spin" />
                  </div>
                )}
                {state === "pending" && (
                  <div className="size-5 shrink-0 rounded-full border border-border/70" />
                )}
                <span
                  className={`text-sm ${
                    state === "done"
                      ? "text-success"
                      : state === "active"
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {status === "COMPLETED" && prUrl ? (
        <div className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-4"
          >
            View PR{prNumber ? ` #${prNumber}` : ""} on GitHub
          </a>
        </div>
      ) : null}

      {(status === "FAILED" || status === "CANCELLED") && errorMsg ? (
        <p className="text-sm text-destructive">{errorMsg}</p>
      ) : null}

      {(status === "FAILED" || status === "CANCELLED") && !errorMsg ? (
        <p className="text-sm text-destructive">
          Resolution failed. You can retry when ready.
        </p>
      ) : null}
    </div>
  );
}
