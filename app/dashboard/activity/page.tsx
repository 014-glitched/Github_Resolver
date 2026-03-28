"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Search,
  ShieldAlert,
  Sparkles,
  XCircle,
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type EventStatus =
  | "PENDING"
  | "RESOLVING"
  | "RESOLVED"
  | "FAILED"
  | "IGNORED";

type EventType =
  | "CI_FAILURE"
  | "PR_CONFLICT"
  | "CODE_ERROR"
  | "MERGE_ERROR"
  | "PR_REVIEW_REQUESTED";

type ActivityEvent = {
  id: string;
  type: EventType;
  title: string;
  description: string | null;
  status: EventStatus;
  payload: unknown;
  createdAt: string;
  repo: { name: string; fullName: string };
  resolveJob: {
    id: string;
    status: string;
    prUrl: string | null;
    prNumber: number | null;
    errorMsg: string | null;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
};

type ActivityResponse = {
  events: ActivityEvent[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  stats: {
    total: number;
    resolved: number;
    failed: number;
    successRate: number;
    mostActiveRepo: string | null;
  };
};

// ── API 
async function fetchActivity(
  status: string,
  search: string,
  page: number,
): Promise<ActivityResponse> {
  const params = new URLSearchParams({
    status,
    search,
    page: String(page),
  });

  const res = await fetch(`/api/github/activity?${params}`);
  if (!res.ok) throw new Error("Failed to fetch activity");
  return res.json();
}

// ── Helpers
const eventTypeConfig: Record<
  EventType,
  { label: string; badgeClassName: string; iconClassName: string }
> = {
  CI_FAILURE: {
    label: "CI Failed",
    badgeClassName: "border-destructive/20 bg-destructive/10 text-destructive",
    iconClassName: "text-destructive",
  },
  PR_CONFLICT: {
    label: "Merge Conflict",
    badgeClassName: "border-warning/20 bg-warning/10 text-warning",
    iconClassName: "text-warning",
  },
  CODE_ERROR: {
    label: "Code Error",
    badgeClassName: "border-destructive/20 bg-destructive/10 text-destructive",
    iconClassName: "text-destructive",
  },
  MERGE_ERROR: {
    label: "Merge Error",
    badgeClassName: "border-warning/20 bg-warning/10 text-warning",
    iconClassName: "text-warning",
  },
  PR_REVIEW_REQUESTED: {
    label: "Review Requested",
    badgeClassName: "border-info/20 bg-info/10 text-info",
    iconClassName: "text-info",
  },
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function groupByDate(events: ActivityEvent[]) {
  const groups: Record<string, ActivityEvent[]> = {};

  events.forEach((event) => {
    const date = new Date(event.createdAt);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    let label: string;
    if (date.toDateString() === now.toDateString()) {
      label = "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      label = "Yesterday";
    } else if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
      label = "This Week";
    } else {
      label = "Older";
    }

    if (!groups[label]) groups[label] = [];
    groups[label].push(event);
  });

  return groups;
}

// ── Status Icon
function StatusIcon({ status }: { status: EventStatus }) {
  if (status === "RESOLVED") {
    return (
      <div className="flex size-9 items-center justify-center rounded-full border border-success/20 bg-success/10 text-success">
        <Check className="size-4" />
      </div>
    );
  }

  if (status === "FAILED") {
    return (
      <div className="flex size-9 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10 text-destructive">
        <XCircle className="size-4" />
      </div>
    );
  }

  if (status === "RESOLVING") {
    return (
      <div className="flex size-9 items-center justify-center rounded-full border border-info/20 bg-info/10 text-info">
        <LoaderCircle className="size-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex size-9 items-center justify-center rounded-full border border-border/70 bg-muted/30 text-muted-foreground">
      <Clock3 className="size-4" />
    </div>
  );
}

function ActivityStats({
  stats,
}: {
  stats: ActivityResponse["stats"];
}) {
  const cards = [
    {
      label: "Total events",
      value: stats.total,
      description: "All tracked activity",
      icon: Activity,
      tone: "text-foreground",
      surface: "bg-muted/40",
    },
    {
      label: "Resolved",
      value: stats.resolved,
      description: "Completed successfully",
      icon: CheckCircle2,
      tone: "text-success",
      surface: "bg-success/10",
    },
    {
      label: "Failed",
      value: stats.failed,
      description: "Need follow-up",
      icon: ShieldAlert,
      tone: "text-destructive",
      surface: "bg-destructive/10",
    },
    {
      label: "Success rate",
      value: `${stats.successRate}%`,
      description: stats.mostActiveRepo
        ? `Most active: ${stats.mostActiveRepo}`
        : "No dominant repository yet",
      icon: Sparkles,
      tone: "text-info",
      surface: "bg-info/10",
    },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, value, description, icon: Icon, tone, surface }) => (
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

function ActivityLoading() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Card key={item}>
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-4 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>
      <SectionCard title="Event timeline" description="Loading activity history...">
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="rounded-xl border border-border/70 p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function DetailModal({
  event,
  open,
  onClose,
}: {
  event: ActivityEvent | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!event) return null;

  const config = eventTypeConfig[event.type];
  const job = event.resolveJob;

  const duration =
    job?.startedAt && job?.completedAt
      ? Math.round(
          (new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000,
        )
      : null;

  const summaryItems = [
    { label: "Repository", value: event.repo.fullName },
    { label: "Status", value: event.status },
    {
      label: "Detected",
      value: new Date(event.createdAt).toLocaleString(),
    },
    {
      label: "Duration",
      value: duration ? `${duration}s` : "Not available",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-screen overflow-y-auto border-border/70 bg-card text-card-foreground sm:max-w-2xl">
        <DialogHeader className="space-y-4">
          <div className="flex items-start gap-4">
            <StatusIcon status={event.status} />
            <div className="space-y-2">
              <Badge variant="outline" className={`h-6 rounded-full px-2.5 text-xs ${config.badgeClassName}`}>
                {config.label}
              </Badge>
              <DialogTitle className="text-left text-lg font-semibold leading-7">
                {event.title}
              </DialogTitle>
              <DialogDescription className="text-left text-sm text-muted-foreground">
                Detailed timeline, repository context, and resolver output for this event.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {summaryItems.map((item) => (
              <div key={item.label} className="rounded-lg border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-2 text-sm text-foreground">{item.value}</p>
              </div>
            ))}
          </div>

          {event.description ? (
            <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Issue description
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{event.description}</p>
            </div>
          ) : null}

          {job?.prUrl ? (
            <div className="rounded-lg border border-success/20 bg-success/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-success/80">
                Pull request created
              </p>
              <a
                href={job.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-success underline-offset-4 hover:underline"
              >
                View PR #{job.prNumber} on GitHub
                <ArrowUpRight className="size-4" />
              </a>
            </div>
          ) : null}

          {job?.errorMsg ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-destructive/80">
                Error details
              </p>
              <p className="mt-2 font-mono text-sm leading-6 text-destructive">{job.errorMsg}</p>
            </div>
          ) : null}

          {job ? (
            <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Job timeline
              </p>
              <div className="mt-4 space-y-3">
                {[
                  { label: "Job queued", time: event.createdAt, done: true },
                  { label: "Started", time: job.startedAt, done: !!job.startedAt },
                  { label: "Completed", time: job.completedAt, done: !!job.completedAt },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`size-2 rounded-full ${
                          item.done ? "bg-success" : "bg-muted-foreground"
                        }`}
                      />
                      <span className={item.done ? "text-sm text-foreground" : "text-sm text-muted-foreground"}>
                        {item.label}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {item.time ? new Date(item.time).toLocaleTimeString() : "Not available"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <a
            href={`https://github.com/${event.repo.fullName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            View repository on GitHub
            <ArrowUpRight className="size-4" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ActivityPage() {
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["activity", status, search, page],
    queryFn: () => fetchActivity(status, search, page),
    staleTime: 30 * 1000,
  });

  const groups = data ? groupByDate(data.events) : {};
  const groupOrder = ["Today", "Yesterday", "This Week", "Older"];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Historical activity"
        title="Activity"
        description="Review the full event history, inspect resolver output, and follow issue outcomes across connected repositories."
        action={
          <Badge variant="secondary" className="h-8 rounded-full bg-primary/10 px-3 text-sm font-medium text-primary">
            <Activity className="size-4" />
            Timeline view
          </Badge>
        }
      />

      {isLoading ? <ActivityLoading /> : null}

      {isError ? (
        <EmptyState
          icon={<AlertCircle className="size-5" />}
          title="Failed to load activity"
          description="The activity history could not be loaded right now. Try refreshing or checking the GitHub connection."
          className="border-destructive/20 bg-destructive/5"
        />
      ) : null}

      {!isLoading && !isError && data ? (
        <>
          <ActivityStats stats={data.stats} />

          <SectionCard title="Filters" description="Search and narrow the event timeline by status.">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <Tabs
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
              >
                <TabsList variant="line" className="flex-wrap gap-2 rounded-xl border border-border/70 bg-card/70 p-1">
                  {["ALL", "RESOLVED", "FAILED", "PENDING", "RESOLVING"].map((item) => (
                    <TabsTrigger key={item} value={item} className="rounded-lg px-3 text-sm">
                      {item === "ALL" ? "All" : item.charAt(0) + item.slice(1).toLowerCase()}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <div className="relative w-full lg:max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by title or repository"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
          </SectionCard>

          {data.events.length === 0 ? (
            <EmptyState
              icon={<Clock3 className="size-5" />}
              title="No activity found"
              description={
                search || status !== "ALL"
                  ? "Try adjusting your filters to see more events."
                  : "Events will appear here once GitHub activity starts flowing through the resolver."
              }
            />
          ) : (
            <SectionCard title="Event timeline" description="Grouped by recency so you can scan the latest activity first.">
              <div className="space-y-8">
                {groupOrder.map((group) => {
                  if (!groups[group]) return null;

                  return (
                    <div key={group} className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {group}
                      </p>
                      <div className="space-y-3">
                        {groups[group].map((event) => {
                          const config = eventTypeConfig[event.type];

                          return (
                            <button
                              key={event.id}
                              type="button"
                              onClick={() => setSelectedEvent(event)}
                              className="flex w-full items-center gap-4 rounded-xl border border-border/70 bg-card/90 p-4 text-left shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
                            >
                              <StatusIcon status={event.status} />

                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={`h-6 rounded-full px-2.5 text-xs font-medium ${config.badgeClassName}`}
                                  >
                                    {config.label}
                                  </Badge>
                                  <span className="truncate text-sm font-semibold text-foreground">
                                    {event.title}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                  <span>{event.repo.fullName}</span>
                                  {event.resolveJob?.prNumber ? (
                                    <span className="text-success">PR #{event.resolveJob.prNumber}</span>
                                  ) : null}
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                                <span>{timeAgo(event.createdAt)}</span>
                                <ChevronRight className="size-4" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {data.pagination.totalPages > 1 ? (
                  <div className="flex flex-col gap-4 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing {(page - 1) * data.pagination.limit + 1}-
                      {Math.min(page * data.pagination.limit, data.pagination.total)} of{" "}
                      {data.pagination.total} events
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!data.pagination.hasPrev}
                        onClick={() => setPage((current) => current - 1)}
                      >
                        Previous
                      </Button>
                      <span className="px-2 text-sm text-muted-foreground">
                        {page} / {data.pagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!data.pagination.hasNext}
                        onClick={() => setPage((current) => current + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </SectionCard>
          )}
        </>
      ) : null}

      <DetailModal
        event={selectedEvent}
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
