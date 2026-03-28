"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  GitPullRequest,
  LoaderCircle,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type EventType =
  | "CI_FAILURE"
  | "PR_CONFLICT"
  | "CODE_ERROR"
  | "MERGE_ERROR"
  | "PR_REVIEW_REQUESTED";
type EventStatus = "PENDING" | "RESOLVING" | "RESOLVED" | "FAILED" | "IGNORED";
type JobStatus =
  | "QUEUED"
  | "FETCHING_CONTEXT"
  | "ANALYZING"
  | "PATCHING"
  | "CREATING_PR"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";
type ResolveJob = {
  id: string;
  status: JobStatus;
  prUrl: string | null;
  prNumber: number | null;
  errorMsg: string | null;
};
type GithubEvent = {
  id: string;
  type: EventType;
  title: string;
  description: string | null;
  sourceBranch: string | null;
  status: EventStatus;
  createdAt: string;
  repo: {
    name: string;
    fullName: string;
  };
  resolveJob: ResolveJob | null;
};

async function fetchEvents(): Promise<{ events: GithubEvent[] }> {
  const res = await fetch("/api/github/events");
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json();
}

async function triggerResolve(
  eventId: string,
  strategy: "same" | "new" | "custom",
  customBranch?: string,
) {
  const res = await fetch("/api/github/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, strategy, customBranch }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? "Failed to trigger resolve");
  }
  return res.json();
}

async function resetEvent(eventId: string) {
  const res = await fetch("/api/github/reset-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId }),
  });
  if (!res.ok) throw new Error("Failed to reset event");
  return res.json();
}

const eventTypeConfig: Record<
  EventType,
  { label: string; badgeClassName: string; dotClassName: string }
> = {
  CI_FAILURE: {
    label: "CI Failed",
    badgeClassName: "border-destructive/20 bg-destructive/10 text-destructive",
    dotClassName: "bg-destructive",
  },
  PR_CONFLICT: {
    label: "Merge Conflict",
    badgeClassName: "border-warning/20 bg-warning/10 text-warning",
    dotClassName: "bg-warning",
  },
  CODE_ERROR: {
    label: "Code Error",
    badgeClassName: "border-destructive/20 bg-destructive/10 text-destructive",
    dotClassName: "bg-destructive",
  },
  MERGE_ERROR: {
    label: "Merge Error",
    badgeClassName: "border-warning/20 bg-warning/10 text-warning",
    dotClassName: "bg-warning",
  },
  PR_REVIEW_REQUESTED: {
    label: "Review Requested",
    badgeClassName: "border-info/20 bg-info/10 text-info",
    dotClassName: "bg-info",
  },
};

const jobSteps: { key: JobStatus; label: string }[] = [
  { key: "FETCHING_CONTEXT", label: "Fetching context" },
  { key: "ANALYZING", label: "Analyzing with Claude" },
  { key: "PATCHING", label: "Generating patch" },
  { key: "CREATING_PR", label: "Creating PR" },
];

function getStepState(stepKey: JobStatus, currentStatus: JobStatus) {
  const order: JobStatus[] = [
    "QUEUED",
    "FETCHING_CONTEXT",
    "ANALYZING",
    "PATCHING",
    "CREATING_PR",
    "COMPLETED",
  ];
  const stepIndex = order.indexOf(stepKey);
  const currentIndex = order.indexOf(currentStatus);
  if (currentStatus === "COMPLETED") return "done";
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "active";
  return "pending";
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getCardState(event: GithubEvent) {
  if (event.resolveJob?.status === "COMPLETED") return "resolved";
  if (event.status === "RESOLVED") return "resolved";
  if (event.resolveJob?.status === "FAILED") return "failed";
  if (event.status === "FAILED") return "failed";
  if (
    event.status === "RESOLVING" ||
    (event.resolveJob &&
      ["QUEUED", "FETCHING_CONTEXT", "ANALYZING", "PATCHING", "CREATING_PR"].includes(
        event.resolveJob.status,
      ))
  ) {
    return "resolving";
  }
  return "pending";
}

// ── Resolve Modal ─────────────────────────────────────────────
function ResolveModal({
  event,
  open,
  onClose,
  onConfirm,
  isTriggering,
}: {
  event: GithubEvent | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (
    eventId: string,
    strategy: "same" | "new" | "custom",
    customBranch?: string,
  ) => void;
  isTriggering: boolean;
}) {
  const [strategy, setStrategy] = useState<"same" | "new" | "custom">("new");
  const [customBranch, setCustomBranch] = useState("");

  if (!event) return null;

  const sourceBranch = event.sourceBranch ?? "main";
  const autoGeneratedBranch = `fix/auto-${event.id.slice(0, 8)}`;

  const handleConfirm = () => {
    if (strategy === "custom" && !customBranch.trim()) return;
    onConfirm(
      event.id,
      strategy,
      strategy === "custom" ? customBranch.trim() : undefined,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="border-border/70 bg-card text-card-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose fix strategy</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Select where the AI-generated fix should be committed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Option 1 — Same branch */}
          <button
            type="button"
            onClick={() => setStrategy("same")}
            className={`w-full rounded-xl border p-4 text-left transition-all ${
              strategy === "same"
                ? "border-primary/40 bg-primary/5"
                : "border-border/70 bg-muted/20 hover:border-primary/20"
            }`}
          >
            <p className="text-sm font-semibold text-foreground">
              Fix in same branch
            </p>
            <p className="mt-1 font-mono text-xs text-primary/80">
              {sourceBranch}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Commits the fix directly to the branch where the error occurred.
            </p>
          </button>

          {/* Option 2 — Auto-generated new branch */}
          <button
            type="button"
            onClick={() => setStrategy("new")}
            className={`w-full rounded-xl border p-4 text-left transition-all ${
              strategy === "new"
                ? "border-primary/40 bg-primary/5"
                : "border-border/70 bg-muted/20 hover:border-primary/20"
            }`}
          >
            <p className="text-sm font-semibold text-foreground">
              Create new branch
            </p>
            <p className="mt-1 font-mono text-xs text-primary/80">
              {autoGeneratedBranch}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Opens a pull request from a new isolated branch.
            </p>
          </button>

          {/* Option 3 — Custom branch name */}
          <button
            type="button"
            onClick={() => setStrategy("custom")}
            className={`w-full rounded-xl border p-4 text-left transition-all ${
              strategy === "custom"
                ? "border-primary/40 bg-primary/5"
                : "border-border/70 bg-muted/20 hover:border-primary/20"
            }`}
          >
            <p className="text-sm font-semibold text-foreground">
              Custom branch name
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Type your own branch name for the fix.
            </p>
            {strategy === "custom" && (
              <Input
                className="mt-3"
                placeholder="e.g. fix/my-custom-branch"
                value={customBranch}
                onChange={(e) => setCustomBranch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            )}
          </button>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          {/* Skip with tooltip */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => onConfirm(event.id, "new")}
                  disabled={isTriggering}
                >
                  Skip
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">A new branch will be created automatically</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isTriggering}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                isTriggering ||
                (strategy === "custom" && !customBranch.trim())
              }
              onClick={handleConfirm}
            >
              {isTriggering ? "Starting..." : "Start resolving"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Stats Grid ────────────────────────────────────────────────
function StatsGrid({ events }: { events: GithubEvent[] }) {
  const openCount = events.filter((e) => getCardState(e) === "pending").length;
  const resolvedCount = events.filter((e) => getCardState(e) === "resolved").length;
  const prCount = events.filter((e) => e.resolveJob?.prUrl).length;

  const stats = [
    {
      label: "Open issues",
      value: openCount,
      description: "Awaiting action",
      tone: "text-destructive",
      surface: "bg-destructive/10",
      icon: AlertCircle,
    },
    {
      label: "Resolved",
      value: resolvedCount,
      description: "Completed successfully",
      tone: "text-success",
      surface: "bg-success/10",
      icon: ShieldCheck,
    },
    {
      label: "PRs created",
      value: prCount,
      description: "Ready for review",
      tone: "text-info",
      surface: "bg-info/10",
      icon: GitPullRequest,
    },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map(({ label, value, description, tone, surface, icon: Icon }) => (
        <Card key={label} className="bg-card/90">
          <CardContent className="flex items-start justify-between gap-4 p-6">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{label}</p>
              <p className={`text-3xl font-semibold tracking-tight ${tone}`}>{value}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <div className={`flex size-11 items-center justify-center rounded-xl ${surface} ${tone}`}>
              <Icon className="size-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Dashboard Loading ─────────────────────────────────────────
function DashboardLoading() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <Card key={item}>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <SectionCard title="Issue feed" description="Loading the latest GitHub events...">
        <div className="space-y-4">
          {[0, 1, 2].map((item) => (
            <div key={item} className="space-y-4 rounded-xl border border-border/70 p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-1 items-center gap-3">
                  <Skeleton className="size-2 rounded-full" />
                  <Skeleton className="h-5 w-28 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-9 w-24" />
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ── Event Card ────────────────────────────────────────────────
function EventCard({
  event,
  onResolve,
  isTriggering,
  onReset,
}: {
  event: GithubEvent;
  onResolve: (event: GithubEvent) => void;
  isTriggering: boolean;
  onReset: (id: string) => void;
}) {
  const config = eventTypeConfig[event.type];
  const job = event.resolveJob;
  const cardState = getCardState(event);
  const isResolving = cardState === "resolving";
  const isResolved = cardState === "resolved";
  const isFailed = cardState === "failed";

  const cardToneClassName =
    cardState === "resolved"
      ? "border-success/20"
      : cardState === "failed"
        ? "border-destructive/20"
        : "border-border/70";

  return (
    <div
      className={`rounded-xl border bg-card/90 p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md ${cardToneClassName}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`size-2 shrink-0 rounded-full ${isResolved ? "bg-success" : config.dotClassName}`}
          />
          <Badge
            variant="outline"
            className={`h-6 rounded-full px-2.5 text-xs font-medium ${config.badgeClassName}`}
          >
            {config.label}
          </Badge>
          <span className="text-sm text-muted-foreground">{event.repo.fullName}</span>
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">
          {timeAgo(event.createdAt)}
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-base font-semibold leading-6 text-foreground">{event.title}</p>
        {event.description ? (
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
            {event.description}
          </p>
        ) : null}
      </div>

      {isResolving && job ? (
        <div className="mt-5 rounded-lg border border-border/70 bg-muted/20 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Resolving
          </p>
          <div className="flex flex-col gap-3">
            {jobSteps.map((step) => {
              const state = getStepState(step.key, job.status);
              return (
                <div key={step.key} className="flex items-center gap-3">
                  {state === "done" ? (
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full border border-success/30 bg-success/10 text-success">
                      <Check className="size-3" />
                    </div>
                  ) : null}
                  {state === "active" ? (
                    <div className="flex size-5 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                      <LoaderCircle className="size-3 animate-spin" />
                    </div>
                  ) : null}
                  {state === "pending" ? (
                    <div className="size-5 shrink-0 rounded-full border border-border/70" />
                  ) : null}
                  <span
                    className={`text-sm ${
                      state === "done"
                        ? "text-success"
                        : state === "active"
                          ? "text-foreground"
                          : "text-muted-foreground"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {isResolved && job?.prUrl ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-success/20 bg-success/10 p-4 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>
            Fix ready.{" "}
            <a
              href={job.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-4 hover:text-success"
            >
              View PR #{job.prNumber} on GitHub
            </a>
          </span>
        </div>
      ) : null}

      {isFailed && job?.errorMsg ? (
        <div className="mt-5 rounded-lg border border-destructive/20 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">Failed: {job.errorMsg}</p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <a
          href={`https://github.com/${event.repo.fullName}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          View on GitHub
          <ArrowUpRight className="size-4" />
        </a>
        <div className="flex flex-wrap items-center gap-2">
          {!isResolved && !isResolving && !isFailed ? (
            <Button
              size="sm"
              disabled={isTriggering}
              onClick={() => onResolve(event)}
              className="shadow-sm"
            >
              {isTriggering ? "Starting..." : "Resolve issue"}
            </Button>
          ) : null}
          {isResolving ? (
            <>
              <Button size="sm" disabled variant="outline">
                Resolving...
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReset(event.id)}
                className="hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              >
                Cancel
              </Button>
            </>
          ) : null}
          {isFailed ? (
            <>
              <span className="text-sm text-destructive/80">Failed</span>
              <Button size="sm" onClick={() => onReset(event.id)} className="shadow-sm">
                Retry
              </Button>
            </>
          ) : null}
          {isResolved ? (
            <Badge
              variant="outline"
              className="h-6 rounded-full border-success/20 bg-success/10 px-2.5 text-xs text-success"
            >
              Resolved
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Dashboard Page ────────────────────────────────────────────
export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [resolveModalEvent, setResolveModalEvent] = useState<GithubEvent | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
  });

  const resolveMutation = useMutation({
    mutationFn: ({
      eventId,
      strategy,
      customBranch,
    }: {
      eventId: string;
      strategy: "same" | "new" | "custom";
      customBranch?: string;
    }) => triggerResolve(eventId, strategy, customBranch),
    onMutate: ({ eventId }) => setTriggeringId(eventId),
    onError: (error) => {
      setTriggeringId(null);
      console.error("Failed to resolve event:", error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setResolveModalEvent(null);
    },
    onSettled: () => setTriggeringId(null),
  });

  const resetMutation = useMutation({
    mutationFn: resetEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const events = data?.events ?? [];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Monitor GitHub issues, follow the resolver pipeline, and jump into pull requests with consistent, low-friction actions."
        action={
          <Badge variant="secondary" className="h-8 rounded-full bg-primary/10 px-3 text-sm font-medium text-primary">
            <Sparkles className="size-4" />
            Live monitoring
          </Badge>
        }
      />

      {isLoading ? <DashboardLoading /> : null}
      {isError ? (
        <EmptyState
          icon={<AlertCircle className="size-5" />}
          title="Failed to load events"
          description="The dashboard could not fetch the latest GitHub events. Refresh the page or verify the GitHub connection."
          className="border-destructive/20 bg-destructive/5"
        />
      ) : null}

      {!isLoading && !isError ? (
        <>
          <StatsGrid events={events} />
          {events.length === 0 ? (
            <EmptyState
              icon={<Clock3 className="size-5" />}
              title="No issues detected yet"
              description="Connected repositories will appear here as soon as new failures, conflicts, or review requests are detected."
              action={
                <Button asChild variant="outline">
                  <Link href="/dashboard/repositories">Manage repositories</Link>
                </Button>
              }
            />
          ) : (
            <SectionCard
              title="Issue feed"
              description="Recent GitHub events with action states, resolver progress, and review links."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["events"] })}
                >
                  <RefreshCcw className="size-4" />
                  Refresh
                </Button>
              }
            >
              <div className="space-y-4">
                {events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onResolve={(e) => setResolveModalEvent(e)}
                    isTriggering={triggeringId === event.id}
                    onReset={(id) => resetMutation.mutate(id)}
                  />
                ))}
              </div>
            </SectionCard>
          )}
        </>
      ) : null}

      <ResolveModal
        event={resolveModalEvent}
        open={!!resolveModalEvent}
        onClose={() => setResolveModalEvent(null)}
        onConfirm={(eventId, strategy, customBranch) =>
          resolveMutation.mutate({ eventId, strategy, customBranch })
        }
        isTriggering={!!triggeringId}
      />
    </div>
  );
}