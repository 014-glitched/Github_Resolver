"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  GitBranch,
  GitPullRequest,
  LoaderCircle,
  MessageSquare,
  RefreshCcw,
  Sparkles,
  Tag,
} from "lucide-react";
import { useState } from "react";
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

// ── Types ─────────────────────────────────────────────────────

type IssueJobStatus =
  | "QUEUED"
  | "FETCHING_CONTEXT"
  | "ANALYZING"
  | "VERIFYING"
  | "CREATING_PR"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

type IssueJob = {
  id: string;
  status: IssueJobStatus;
  prUrl: string | null;
  prNumber: number | null;
  errorMsg: string | null;
  verifyVerdict: string | null;
  createdAt: string;
  completedAt: string | null;
};

type GithubIssue = {
  number: number;
  title: string;
  body: string;
  url: string;
  state: string;
  labels: string[];
  author: string;
  authorAvatar: string | null;
  createdAt: string;
  updatedAt: string;
  commentsCount: number;
  job: IssueJob | null;
};

type Repo = {
  id: string;
  name: string;
  fullName: string;
};

// ── API helpers ───────────────────────────────────────────────

async function fetchRepos(): Promise<{ repos: Repo[] }> {
  const res = await fetch("/api/github/connected-repos");
  if (!res.ok) throw new Error("Failed to fetch repos");
  return res.json();
}

async function fetchIssues(
  repoId: string,
): Promise<{ issues: GithubIssue[]; repoFullName: string }> {
  const res = await fetch(`/api/github/issues?repoId=${repoId}`);
  if (!res.ok) throw new Error("Failed to fetch issues");
  return res.json();
}

async function triggerIssueResolve(payload: {
  repoId: string;
  issueNumber: number;
  issueTitle: string;
  issueBody: string;
  issueUrl: string;
  strategy: "same" | "new" | "custom";
  customBranch?: string;
}) {
  const res = await fetch("/api/github/issues/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? "Failed to trigger resolve");
  }
  return res.json();
}

// ── Utilities ─────────────────────────────────────────────────

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Label color mapping — matches GitHub's default label colors roughly
function getLabelStyle(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("bug") || lower.includes("error") || lower.includes("crash"))
    return "border-destructive/20 bg-destructive/10 text-destructive";
  if (lower.includes("good first") || lower.includes("beginner") || lower.includes("easy"))
    return "border-success/20 bg-success/10 text-success";
  if (lower.includes("ui") || lower.includes("design") || lower.includes("style"))
    return "border-info/20 bg-info/10 text-info";
  if (lower.includes("help") || lower.includes("question"))
    return "border-warning/20 bg-warning/10 text-warning";
  if (lower.includes("feature") || lower.includes("enhancement"))
    return "border-primary/20 bg-primary/10 text-primary";
  return "border-border/60 bg-muted/40 text-muted-foreground";
}

// Job step definitions — matches the IssueJobStatus flow
const issueJobSteps: { key: IssueJobStatus; label: string }[] = [
  { key: "FETCHING_CONTEXT", label: "Fetching issue context" },
  { key: "ANALYZING", label: "Generating fix with Claude" },
  { key: "VERIFYING", label: "Verifying fix (self-review)" },
  { key: "CREATING_PR", label: "Creating pull request" },
];

function getStepState(
  stepKey: IssueJobStatus,
  currentStatus: IssueJobStatus,
): "done" | "active" | "pending" {
  const order: IssueJobStatus[] = [
    "QUEUED",
    "FETCHING_CONTEXT",
    "ANALYZING",
    "VERIFYING",
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

function getJobCardState(job: IssueJob | null) {
  if (!job) return "idle";
  if (job.status === "COMPLETED") return "resolved";
  if (job.status === "FAILED" || job.status === "CANCELLED") return "failed";
  return "resolving";
}

// ── Resolve Modal ─────────────────────────────────────────────

function IssueResolveModal({
  issue,
  repoId,
  open,
  onClose,
  onConfirm,
  isTriggering,
}: {
  issue: GithubIssue | null;
  repoId: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    repoId: string;
    issueNumber: number;
    issueTitle: string;
    issueBody: string;
    issueUrl: string;
    strategy: "same" | "new" | "custom";
    customBranch?: string;
  }) => void;
  isTriggering: boolean;
}) {
  const [strategy, setStrategy] = useState<"same" | "new" | "custom">("new");
  const [customBranch, setCustomBranch] = useState("");

  if (!issue) return null;

  const autoGeneratedBranch = `fix/issue-${issue.number}`;

  const handleConfirm = () => {
    if (strategy === "custom" && !customBranch.trim()) return;
    onConfirm({
      repoId,
      issueNumber: issue.number,
      issueTitle: issue.title,
      issueBody: issue.body,
      issueUrl: issue.url,
      strategy,
      customBranch: strategy === "custom" ? customBranch.trim() : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="border-border/70 bg-card text-card-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose fix strategy</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Select where the AI-generated fix for{" "}
            <span className="font-medium text-foreground">
              #{issue.number}
            </span>{" "}
            should be committed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Option 1 — Same branch (default) */}
          <button
            type="button"
            onClick={() => setStrategy("same")}
            className={`w-full rounded-xl border p-4 text-left transition-all ${
              strategy === "same"
                ? "border-primary/40 bg-primary/5"
                : "border-border/60 hover:border-border hover:bg-muted/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Fix on default branch</span>
              {strategy === "same" && (
                <div className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-2.5" />
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Commits directly to the repo's default branch
            </p>
          </button>

          {/* Option 2 — New branch (recommended) */}
          <button
            type="button"
            onClick={() => setStrategy("new")}
            className={`w-full rounded-xl border p-4 text-left transition-all ${
              strategy === "new"
                ? "border-primary/40 bg-primary/5"
                : "border-border/60 hover:border-border hover:bg-muted/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Create new branch{" "}
                <span className="ml-1 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                  {autoGeneratedBranch}
                </span>
              </span>
              {strategy === "new" && (
                <div className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-2.5" />
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Recommended — keeps default branch clean, opens a PR for review
            </p>
          </button>

          {/* Option 3 — Custom branch */}
          <button
            type="button"
            onClick={() => setStrategy("custom")}
            className={`w-full rounded-xl border p-4 text-left transition-all ${
              strategy === "custom"
                ? "border-primary/40 bg-primary/5"
                : "border-border/60 hover:border-border hover:bg-muted/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Custom branch name</span>
              {strategy === "custom" && (
                <div className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-2.5" />
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Type your own branch name
            </p>
            {strategy === "custom" && (
              <Input
                className="mt-3 h-8 font-mono text-xs"
                placeholder="fix/my-custom-branch"
                value={customBranch}
                onChange={(e) => setCustomBranch(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            )}
          </button>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Skip
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>A new branch will be created automatically</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            onClick={handleConfirm}
            disabled={
              isTriggering ||
              (strategy === "custom" && !customBranch.trim())
            }
          >
            {isTriggering ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Starting...
              </>
            ) : (
              "Resolve with AI"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Issue Card ────────────────────────────────────────────────

function IssueCard({
  issue,
  onResolve,
  isTriggering,
}: {
  issue: GithubIssue;
  onResolve: (issue: GithubIssue) => void;
  isTriggering: boolean;
}) {
  const { job } = issue;
  const cardState = getJobCardState(job);
  const isResolving = cardState === "resolving";
  const isResolved = cardState === "resolved";
  const isFailed = cardState === "failed";

  return (
    <Card
      className={`border transition-all ${
        isResolved
          ? "border-success/20 bg-success/5"
          : isFailed
            ? "border-destructive/20 bg-destructive/5"
            : isResolving
              ? "border-primary/20 bg-primary/5"
              : "border-border/60 bg-card"
      }`}
    >
      <CardContent className="p-5">
        {/* Top row — number, title, status dot */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {/* Status dot */}
            <div className="mt-1.5 shrink-0">
              <div
                className={`size-2 rounded-full ${
                  isResolved
                    ? "bg-success"
                    : isFailed
                      ? "bg-destructive"
                      : isResolving
                        ? "animate-pulse bg-primary"
                        : "bg-muted-foreground/40"
                }`}
              />
            </div>

            <div className="min-w-0">
              {/* Issue number + title */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  #{issue.number}
                </span>
                <p className="truncate text-sm font-medium text-foreground">
                  {issue.title}
                </p>
              </div>

              {/* Labels */}
              {issue.labels.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {issue.labels.map((label) => (
                    <span
                      key={label}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${getLabelStyle(label)}`}
                    >
                      <Tag className="size-2.5" />
                      {label}
                    </span>
                  ))}
                </div>
              )}

              {/* Meta row — author, age, comments */}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {issue.authorAvatar ? (
                  <div className="flex items-center gap-1.5">
                    <img
                      src={issue.authorAvatar}
                      alt={issue.author}
                      className="size-4 rounded-full"
                    />
                    <span>{issue.author}</span>
                  </div>
                ) : (
                  <span>{issue.author}</span>
                )}
                <span className="flex items-center gap-1">
                  <Clock3 className="size-3" />
                  {timeAgo(issue.createdAt)}
                </span>
                {issue.commentsCount > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="size-3" />
                    {issue.commentsCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Status badge (right side) */}
          {isResolved && (
            <Badge
              variant="outline"
              className="h-6 shrink-0 rounded-full border-success/20 bg-success/10 px-2.5 text-xs text-success"
            >
              Resolved
            </Badge>
          )}
          {isFailed && (
            <Badge
              variant="outline"
              className="h-6 shrink-0 rounded-full border-destructive/20 bg-destructive/10 px-2.5 text-xs text-destructive"
            >
              Failed
            </Badge>
          )}
          {isResolving && (
            <Badge
              variant="outline"
              className="h-6 shrink-0 rounded-full border-primary/20 bg-primary/10 px-2.5 text-xs text-primary"
            >
              <LoaderCircle className="mr-1 size-3 animate-spin" />
              {job?.status === "QUEUED"
                ? "Queued"
                : job?.status === "FETCHING_CONTEXT"
                  ? "Fetching"
                  : job?.status === "ANALYZING"
                    ? "Analyzing"
                    : job?.status === "VERIFYING"
                      ? "Verifying"
                      : "Creating PR"}
            </Badge>
          )}
        </div>

        {/* Progress steps — shown while resolving */}
        {isResolving && job ? (
          <div className="mt-4 rounded-lg border border-border/60 bg-background/60 p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Resolving
            </p>
            <div className="flex flex-col gap-3">
              {issueJobSteps.map((s) => {
                const state = getStepState(s.key, job.status);
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
          </div>
        ) : null}

        {/* PR link — shown when completed */}
        {isResolved && job?.prUrl ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-success/20 bg-success/10 p-4 text-sm text-success">
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
            {job.verifyVerdict === "revised" && (
              <span className="ml-auto text-xs text-success/70">
                ⚠️ AI revised fix before PR
              </span>
            )}
            {job.verifyVerdict === "approved" && (
              <span className="ml-auto text-xs text-success/70">
                ✅ AI approved fix
              </span>
            )}
          </div>
        ) : null}

        {/* Error — shown when failed */}
        {isFailed && job?.errorMsg ? (
          <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              Failed: {job.errorMsg}
            </p>
          </div>
        ) : null}

        {/* Bottom row — GitHub link + action button */}
        <div className="mt-4 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <a
            href={issue.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            View on GitHub
            <ArrowUpRight className="size-4" />
          </a>

          <div className="flex flex-wrap items-center gap-2">
            {/* Idle — no job yet */}
            {cardState === "idle" && (
              <Button
                size="sm"
                disabled={isTriggering}
                onClick={() => onResolve(issue)}
                className="shadow-sm"
              >
                {isTriggering ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Resolve with AI
                  </>
                )}
              </Button>
            )}

            {/* Resolving — in progress */}
            {isResolving && (
              <Button size="sm" disabled variant="outline">
                <LoaderCircle className="size-4 animate-spin" />
                Resolving...
              </Button>
            )}

            {/* Failed — allow retry */}
            {isFailed && (
              <Button
                size="sm"
                onClick={() => onResolve(issue)}
                className="shadow-sm"
              >
                <RefreshCcw className="size-4" />
                Retry
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Loading skeleton ──────────────────────────────────────────

function IssuesLoading() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <Skeleton className="mt-1.5 size-2 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Repo selector tabs ────────────────────────────────────────

function RepoTabs({
  repos,
  selectedRepoId,
  onSelect,
}: {
  repos: Repo[];
  selectedRepoId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {repos.map((repo) => (
        <button
          key={repo.id}
          type="button"
          onClick={() => onSelect(repo.id)}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
            selectedRepoId === repo.id
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground"
          }`}
        >
          {repo.name}
        </button>
      ))}
    </div>
  );
}

// ── Issues Page ───────────────────────────────────────────────

export default function IssuesPage() {
  const queryClient = useQueryClient();
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [resolveModalIssue, setResolveModalIssue] =
    useState<GithubIssue | null>(null);
  const [triggeringNumber, setTriggeringNumber] = useState<number | null>(null);

  // Fetch connected repos
  const {
    data: reposData,
    isLoading: reposLoading,
    isError: reposError,
  } = useQuery({
    queryKey: ["repos"],
    queryFn: fetchRepos,
    // Auto-select first repo once loaded
    select: (data) => {
      if (!selectedRepoId && data.repos.length > 0) {
        // Note: we set this in the render below to avoid issues with select
      }
      return data;
    },
  });

  const repos = reposData?.repos ?? [];

  // Auto-select first repo when repos load
  const effectiveRepoId =
    selectedRepoId ?? (repos.length > 0 ? repos[0].id : null);

  // Fetch issues for selected repo
  const {
    data: issuesData,
    isLoading: issuesLoading,
    isError: issuesError,
  } = useQuery({
    queryKey: ["issues", effectiveRepoId],
    queryFn: () => fetchIssues(effectiveRepoId!),
    enabled: !!effectiveRepoId,
    // Poll every 5 seconds to get live job status updates
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });

  const issues = issuesData?.issues ?? [];

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: triggerIssueResolve,
    onMutate: ({ issueNumber }) => setTriggeringNumber(issueNumber),
    onError: (error) => {
      setTriggeringNumber(null);
      console.error("Failed to resolve issue:", error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["issues", effectiveRepoId],
      });
      setResolveModalIssue(null);
    },
    onSettled: () => setTriggeringNumber(null),
  });

  const isLoading = reposLoading || (!!effectiveRepoId && issuesLoading);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="AI Resolution"
        title="GitHub Issues"
        description="Browse open issues across your connected repos and resolve them automatically with Claude AI."
        action={
          <Badge
            variant="secondary"
            className="h-8 rounded-full bg-primary/10 px-3 text-sm font-medium text-primary"
          >
            <Sparkles className="size-4" />
            AI powered
          </Badge>
        }
      />

      {/* Repo selector */}
      {repos.length > 0 && (
        <RepoTabs
          repos={repos}
          selectedRepoId={effectiveRepoId ?? ""}
          onSelect={(id) => {
            setSelectedRepoId(id);
            queryClient.invalidateQueries({ queryKey: ["issues", id] });
          }}
        />
      )}

      {/* No repos connected */}
      {!reposLoading && repos.length === 0 && (
        <EmptyState
          icon={<GitBranch className="size-5" />}
          title="No repositories connected"
          description="Connect a GitHub repository to start browsing and resolving issues with AI."
          action={
            <Button asChild variant="outline">
              <a href="/dashboard/repositories">Connect a repository</a>
            </Button>
          }
        />
      )}

      {/* Error fetching repos */}
      {reposError && (
        <EmptyState
          icon={<AlertCircle className="size-5" />}
          title="Failed to load repositories"
          description="Could not fetch your connected repositories. Refresh the page or check your GitHub connection."
          className="border-destructive/20 bg-destructive/5"
        />
      )}

      {/* Issues section */}
      {effectiveRepoId && (
        <>
          {isLoading && <IssuesLoading />}

          {issuesError && !issuesLoading && (
            <EmptyState
              icon={<AlertCircle className="size-5" />}
              title="Failed to load issues"
              description="Could not fetch issues from GitHub. Verify the repository is accessible and try again."
              className="border-destructive/20 bg-destructive/5"
            />
          )}

          {!isLoading && !issuesError && issues.length === 0 && (
            <EmptyState
              icon={<Clock3 className="size-5" />}
              title="No open issues"
              description="This repository has no open issues right now. Issues will appear here as they are opened on GitHub."
            />
          )}

          {!isLoading && !issuesError && issues.length > 0 && (
            <SectionCard
              title={`Open issues · ${issues.length}`}
              description={`Showing all open issues for ${issuesData?.repoFullName}. Click "Resolve with AI" to generate a fix.`}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    queryClient.invalidateQueries({
                      queryKey: ["issues", effectiveRepoId],
                    })
                  }
                >
                  <RefreshCcw className="size-4" />
                  Refresh
                </Button>
              }
            >
              <div className="space-y-4">
                {issues.map((issue) => (
                  <IssueCard
                    key={issue.number}
                    issue={issue}
                    onResolve={(i) => setResolveModalIssue(i)}
                    isTriggering={triggeringNumber === issue.number}
                  />
                ))}
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* Resolve modal */}
      <IssueResolveModal
        issue={resolveModalIssue}
        repoId={effectiveRepoId ?? ""}
        open={!!resolveModalIssue}
        onClose={() => setResolveModalIssue(null)}
        onConfirm={(payload) => resolveMutation.mutate(payload)}
        isTriggering={resolveMutation.isPending}
      />
    </div>
  );
}
