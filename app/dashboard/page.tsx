"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────
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
  status: EventStatus;
  createdAt: string;
  repo: {
    name: string;
    fullName: string;
  };
  resolveJob: ResolveJob | null;
};

// ── API functions ─────────────────────────────────────────────
async function fetchEvents(): Promise<{ events: GithubEvent[] }> {
  const res = await fetch("/api/github/events");
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json();
}

async function triggerResolve(eventId: string) {
  console.log("Triggering resolve for eventId:", eventId);
  const res = await fetch("/api/github/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId }),
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

// ── Helpers ───────────────────────────────────────────────────
const eventTypeConfig: Record<
  EventType,
  { label: string; color: string; dot: string }
> = {
  CI_FAILURE: {
    label: "CI Failed",
    color: "border-red-500/20 text-red-400",
    dot: "bg-red-500",
  },
  PR_CONFLICT: {
    label: "Merge Conflict",
    color: "border-yellow-500/20 text-yellow-400",
    dot: "bg-yellow-500",
  },
  CODE_ERROR: {
    label: "Code Error",
    color: "border-red-500/20 text-red-400",
    dot: "bg-red-500",
  },
  MERGE_ERROR: {
    label: "Merge Error",
    color: "border-yellow-500/20 text-yellow-400",
    dot: "bg-yellow-500",
  },
  PR_REVIEW_REQUESTED: {
    label: "Review Requested",
    color: "border-blue-500/20 text-blue-400",
    dot: "bg-blue-500",
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

// ── Event Card ────────────────────────────────────────────────
function EventCard({
  event,
  onResolve,
  isTriggering,
  onReset,
}: {
  event: GithubEvent;
  onResolve: (id: string) => void;
  isTriggering: boolean;
  onReset: (id: string) => void;
}) {
  const config = eventTypeConfig[event.type];
  const job = event.resolveJob;
  const isResolving =
    event.status === "RESOLVING" ||
    (job && !["COMPLETED", "FAILED", "CANCELLED"].includes(job.status));
  const isResolved = event.status === "RESOLVED" || job?.status === "COMPLETED";
  const isFailed = job?.status === "FAILED";

  return (
    <div
      className={`border rounded-xl p-5 transition-all duration-200 ${
        isResolved
          ? "border-emerald-500/20 bg-[#0D130F]"
          : isFailed
            ? "border-red-500/20 bg-[#130D0D]"
            : "border-[#222] bg-[#111]"
      }`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`w-2 h-2 rounded-full shrink-0 ${config.dot}`} />
          <Badge
            variant="outline"
            className={`text-[10px] px-2 py-0 h-5 rounded-md ${config.color}`}
          >
            {config.label}
          </Badge>
          <span className="text-[12px] text-[#555]">{event.repo.fullName}</span>
        </div>
        <span className="text-[11px] text-[#444] shrink-0">
          {timeAgo(event.createdAt)}
        </span>
      </div>

      {/* Title */}
      <p className="text-[14px] font-medium text-white/80 mb-1.5 leading-snug">
        {event.title}
      </p>

      {/* Description */}
      {event.description && (
        <p className="text-[12px] text-[#555] mb-4 line-clamp-2 leading-relaxed">
          {event.description}
        </p>
      )}

      {/* Job progress — shown while resolving */}
      {isResolving && job && (
        <div className="mb-4 p-3 rounded-lg bg-white/3 border border-[#222]">
          <p className="text-[11px] text-[#555] uppercase tracking-widest mb-3">
            Resolving
          </p>
          <div className="flex flex-col gap-2">
            {jobSteps.map((s) => {
              const state = getStepState(s.key, job.status);
              return (
                <div key={s.key} className="flex items-center gap-2.5">
                  {state === "done" && (
                    <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <svg
                        className="w-2.5 h-2.5 text-emerald-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                  {state === "active" && (
                    <div className="w-4 h-4 rounded-full border border-white/20 flex items-center justify-center shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
                    </div>
                  )}
                  {state === "pending" && (
                    <div className="w-4 h-4 rounded-full border border-[#333] shrink-0" />
                  )}
                  <span
                    className={`text-[12px] ${
                      state === "done"
                        ? "text-emerald-400"
                        : state === "active"
                          ? "text-white/70"
                          : "text-[#444]"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resolved state */}
      {isResolved && job?.prUrl && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
          <svg
            className="w-4 h-4 text-emerald-400 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-[12px] text-emerald-400">
            Fixed —{" "}
            <a
              href={job.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-emerald-300"
            >
              View PR #{job.prNumber} on GitHub →
            </a>
          </span>
        </div>
      )}

      {/* Failed state */}
      {isFailed && job?.errorMsg && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/5 border border-red-500/15">
          <p className="text-[12px] text-red-400">Failed: {job.errorMsg}</p>
        </div>
      )}

      {/* Bottom row */}
      {/* Bottom row */}
      <div className="flex items-center justify-between">
        <a
          href={`https://github.com/${event.repo.fullName}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] text-[#444] hover:text-[#888] transition-colors"
        >
          View on GitHub →
        </a>

        <div className="flex items-center gap-2">
          {!isResolved && !isResolving && !isFailed && (
            <Button
              size="sm"
              disabled={isTriggering}
              onClick={() => onResolve(event.id)}
              className="h-8 text-[12px] bg-white/90 text-black hover:bg-white transition-all"
            >
              {isTriggering ? "Starting..." : "Resolve"}
            </Button>
          )}

          {isResolving && (
            <>
              <Button
                size="sm"
                disabled
                className="h-8 text-[12px] bg-transparent border border-[#333] text-[#555]"
              >
                Resolving...
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReset(event.id)}
                className="h-8 text-[12px] border-[#333] text-[#666] hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/5"
              >
                Cancel
              </Button>
            </>
          )}

          {isFailed && (
            <>
              <span className="text-[11px] text-red-400/70">Failed</span>
              <Button
                size="sm"
                onClick={() => onReset(event.id)}
                className="h-8 text-[12px] bg-white/90 text-black hover:bg-white"
              >
                Retry
              </Button>
            </>
          )}

          {isResolved && (
            <Badge
              variant="outline"
              className="text-[11px] border-emerald-500/30 text-emerald-500/80"
            >
              Resolved
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["events"],
    queryFn: fetchEvents,
    // Poll every 4 seconds to get live job status updates
    refetchInterval: 4000,
    refetchIntervalInBackground: false,
  });

  const resolveMutation = useMutation({
    mutationFn: triggerResolve,
    onMutate: (eventId) => setTriggeringId(eventId),
    onError: (error, eventId) => {
      // Clear triggering state on error
      setTriggeringId(null);
      console.error("Failed to resolve event:", error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
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
  const openCount = events.filter((e) => e.status === "PENDING").length;
  const resolvedCount = events.filter((e) => e.status === "RESOLVED").length;
  const prCount = events.filter((e) => e.resolveJob?.prUrl).length;

  return (
    <div className="p-8 min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-[22px] font-semibold text-white/90 tracking-tight">
          Dashboard
        </h2>
        <p className="text-[13px] text-[#555] mt-1">
          Monitor and resolve your GitHub issues automatically.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          {
            label: "Open Issues",
            value: openCount,
            description: "Awaiting resolution",
            color: "#FF6B6B",
          },
          {
            label: "Resolved",
            value: resolvedCount,
            description: "Fixed by AI",
            color: "#00FFA3",
          },
          {
            label: "PRs Created",
            value: prCount,
            description: "Opened automatically",
            color: "#00C9FF",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="border border-[#222] rounded-xl p-5 bg-[#111]"
          >
            <p className="text-[11px] text-[#555] uppercase tracking-widest mb-3">
              {stat.label}
            </p>
            <p
              className="text-3xl font-semibold mb-1"
              style={{ color: stat.color }}
            >
              {stat.value}
            </p>
            <p className="text-[12px] text-[#444]">{stat.description}</p>
          </div>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="border border-[#222] rounded-xl p-5 bg-[#111] animate-pulse h-32"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="border border-red-500/20 rounded-xl p-6 bg-red-500/5 text-center">
          <p className="text-[13px] text-red-400">Failed to load events.</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && events.length === 0 && (
        <div className="border border-dashed border-[#222] rounded-xl p-16 text-center bg-[#111]/50">
          <div className="w-10 h-10 rounded-xl bg-white/3 border border-[#222] flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-5 h-5 text-[#444]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-[13px] text-[#444] font-medium">
            No issues detected yet
          </p>
          <p className="text-[12px] text-[#333] mt-1">
            Connect your repositories to start monitoring
          </p>
        </div>
      )}

      {/* Event feed */}
      {!isLoading && !isError && events.length > 0 && (
        <div className="flex flex-col gap-3">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onResolve={(id) => resolveMutation.mutate(id)}
              isTriggering={triggeringId === event.id}
              onReset={(id) => resetMutation.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
