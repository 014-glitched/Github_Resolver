"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Types
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
  payload: any;
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
  page: number
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
  { label: string; color: string }
> = {
  CI_FAILURE: {
    label: "CI Failed",
    color: "border-red-500/20 text-red-400",
  },
  PR_CONFLICT: {
    label: "Merge Conflict",
    color: "border-yellow-500/20 text-yellow-400",
  },
  CODE_ERROR: {
    label: "Code Error",
    color: "border-red-500/20 text-red-400",
  },
  MERGE_ERROR: {
    label: "Merge Error",
    color: "border-yellow-500/20 text-yellow-400",
  },
  PR_REVIEW_REQUESTED: {
    label: "Review Requested",
    color: "border-blue-500/20 text-blue-400",
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
      <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
        <svg
          className="w-3.5 h-3.5 text-emerald-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
    );
  }
  if (status === "FAILED") {
    return (
      <div className="w-7 h-7 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
        <svg
          className="w-3.5 h-3.5 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
    );
  }
  if (status === "RESOLVING") {
    return (
      <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-white/5 border border-[#333] flex items-center justify-center shrink-0">
      <div className="w-2 h-2 rounded-full bg-[#555]" />
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────
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
          (new Date(job.completedAt).getTime() -
            new Date(job.startedAt).getTime()) /
            1000
        )
      : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#111] border border-[#222] text-white max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <StatusIcon status={event.status} />
            <div>
              <Badge
                variant="outline"
                className={`text-[10px] px-2 py-0 h-4 mb-1.5 ${config.color}`}
              >
                {config.label}
              </Badge>
              <DialogTitle className="text-[14px] font-medium text-white/85 leading-snug">
                {event.title}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Repository", value: event.repo.fullName },
              { label: "Status", value: event.status },
              {
                label: "Detected",
                value: new Date(event.createdAt).toLocaleString(),
              },
              {
                label: "Duration",
                value: duration ? `${duration}s` : "—",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="p-3 rounded-lg bg-white/3 border border-[#1A1A1A]"
              >
                <p className="text-[10px] text-[#555] uppercase tracking-widest mb-1">
                  {item.label}
                </p>
                <p className="text-[12px] text-[#C4C4C4] truncate">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Description */}
          {event.description && (
            <div className="p-3 rounded-lg bg-white/3 border border-[#1A1A1A]">
              <p className="text-[10px] text-[#555] uppercase tracking-widest mb-2">
                Issue Description
              </p>
              <p className="text-[12px] text-[#888] leading-relaxed">
                {event.description}
              </p>
            </div>
          )}

          {/* PR link */}
          {job?.prUrl && (
            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
              <p className="text-[10px] text-emerald-400/70 uppercase tracking-widest mb-2">
                Pull Request Created
              </p>
              <a
                href={job.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
              >
                View PR #{job.prNumber} on GitHub →
              </a>
            </div>
          )}

          {/* Error */}
          {job?.errorMsg && (
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/15">
              <p className="text-[10px] text-red-400/70 uppercase tracking-widest mb-2">
                Error Details
              </p>
              <p className="text-[12px] text-red-400/80 leading-relaxed font-mono">
                {job.errorMsg}
              </p>
            </div>
          )}

          {/* Job Timeline */}
          {job && (
            <div className="p-3 rounded-lg bg-white/3 border border-[#1A1A1A]">
              <p className="text-[10px] text-[#555] uppercase tracking-widest mb-3">
                Job Timeline
              </p>
              <div className="flex flex-col gap-2">
                {[
                  { label: "Job Queued", time: event.createdAt, done: true },
                  { label: "Started", time: job.startedAt, done: !!job.startedAt },
                  { label: "Completed", time: job.completedAt, done: !!job.completedAt },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${
                          item.done ? "bg-emerald-500" : "bg-[#333]"
                        }`}
                      />
                      <span
                        className={`text-[12px] ${
                          item.done ? "text-[#888]" : "text-[#444]"
                        }`}
                      >
                        {item.label}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#444]">
                      {item.time
                        ? new Date(item.time).toLocaleTimeString()
                        : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Repo link */}
          <a
            href={`https://github.com/${event.repo.fullName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-[#444] hover:text-[#888] transition-colors text-center"
          >
            View repository on GitHub →
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function ActivityPage() {
  const [status, setStatus] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<ActivityEvent | null>(
    null
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ["activity", status, search, page],
    queryFn: () => fetchActivity(status, search, page),
    staleTime: 30 * 1000,
  });

  const groups = data ? groupByDate(data.events) : {};
  const groupOrder = ["Today", "Yesterday", "This Week", "Older"];

  return (
    <div className="p-8 min-h-screen bg-[#0A0A0A]">

      {/* Header */}
      <div className="mb-8">
        <h2 className="text-[22px] font-semibold text-white/90 tracking-tight">
          Activity
        </h2>
        <p className="text-[13px] text-[#555] mt-1">
          Full history of all GitHub events and resolutions.
        </p>
      </div>

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl bg-[#111]" />
          ))}
        </div>
      ) : data?.stats ? (
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            {
              label: "Total Events",
              value: data.stats.total,
              color: "text-white/80",
            },
            {
              label: "Resolved",
              value: data.stats.resolved,
              color: "text-emerald-400",
            },
            {
              label: "Failed",
              value: data.stats.failed,
              color: "text-red-400",
            },
            {
              label: "Success Rate",
              value: `${data.stats.successRate}%`,
              color: "text-blue-400",
            },
          ].map((stat) => (
            <Card
              key={stat.label}
              className="border-[#222] bg-[#111] rounded-xl"
            >
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-[11px] text-[#555] uppercase tracking-widest font-normal">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className={`text-2xl font-semibold ${stat.color}`}>
                  {stat.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Tabs
          value={status}
          onValueChange={(val) => {
            setStatus(val);
            setPage(1);
          }}
        >
          <TabsList className="bg-[#111] border border-[#222] h-9">
            {["ALL", "RESOLVED", "FAILED", "PENDING", "RESOLVING"].map(
              (s) => (
                <TabsTrigger
                  key={s}
                  value={s}
                  className="text-[11px] data-[state=active]:bg-white/8 data-[state=active]:text-white text-[#555]"
                >
                  {s === "ALL"
                    ? "All"
                    : s.charAt(0) + s.slice(1).toLowerCase()}
                </TabsTrigger>
              )
            )}
          </TabsList>
        </Tabs>

        <Input
          placeholder="Search by title or repo..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="flex-1 min-w-48 h-9 bg-[#111] border-[#222] text-[12px] text-[#C4C4C4] placeholder:text-[#444] focus-visible:ring-0 focus-visible:border-[#333]"
        />
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="flex flex-col gap-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl bg-[#111]" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="border border-red-500/20 rounded-xl p-6 bg-red-500/5 text-center">
          <p className="text-[13px] text-red-400">
            Failed to load activity.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && data?.events.length === 0 && (
        <div className="border border-dashed border-[#222] rounded-xl p-16 text-center">
          <p className="text-[13px] text-[#444] font-medium">
            No activity found
          </p>
          <p className="text-[12px] text-[#333] mt-1">
            {search || status !== "ALL"
              ? "Try adjusting your filters"
              : "Events will appear here once GitHub issues are detected"}
          </p>
        </div>
      )}

      {/* Event list */}
      {!isLoading && !isError && data && data.events.length > 0 && (
        <div className="flex flex-col gap-6">
          {groupOrder.map((group) => {
            if (!groups[group]) return null;
            return (
              <div key={group}>
                <p className="text-[11px] text-[#444] uppercase tracking-widest mb-3">
                  {group}
                </p>
                <div className="flex flex-col gap-2">
                  {groups[group].map((event) => {
                    const config = eventTypeConfig[event.type];
                    return (
                      <div
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className="border border-[#1A1A1A] rounded-xl p-4 bg-[#111] hover:border-[#333] hover:bg-[#131313] transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <StatusIcon status={event.status} />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${config.color}`}
                              >
                                {config.label}
                              </Badge>
                              <span className="text-[13px] text-white/75 truncate font-medium">
                                {event.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] text-[#444]">
                                {event.repo.fullName}
                              </span>
                              {event.resolveJob?.prNumber && (
                                <span className="text-[11px] text-emerald-500/60">
                                  PR #{event.resolveJob.prNumber}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-[11px] text-[#444]">
                              {timeAgo(event.createdAt)}
                            </span>
                            <svg
                              className="w-4 h-4 text-[#333]"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={1.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M8.25 4.5l7.5 7.5-7.5 7.5"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-[#1A1A1A]">
              <p className="text-[12px] text-[#444]">
                Showing {(page - 1) * 20 + 1}–
                {Math.min(page * 20, data.pagination.total)} of{" "}
                {data.pagination.total} events
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.pagination.hasPrev}
                  onClick={() => setPage((p) => p - 1)}
                  className="h-8 text-[12px] border-[#333] bg-transparent text-[#666] hover:text-white hover:border-[#444] disabled:opacity-30"
                >
                  Previous
                </Button>
                <span className="text-[12px] text-[#444] px-2">
                  {page} / {data.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.pagination.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                  className="h-8 text-[12px] border-[#333] bg-transparent text-[#666] hover:text-white hover:border-[#444] disabled:opacity-30"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      <DetailModal
        event={selectedEvent}
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}