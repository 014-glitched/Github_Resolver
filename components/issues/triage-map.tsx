"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  formatAgeDays,
  labelCategoryFillClass,
  riskStrokeClass,
  riskStrokeWidth,
  type PlotPoint,
} from "@/src/lib/triage/map";
import { cn } from "@/lib/utils";

type TriageMapProps = {
  points: PlotPoint[];
  missingCount: number;
  onSelect: (issueNumber: number) => void;
  onTriageMissing?: () => void;
  selectedIssueNumber?: number | null;
};

const WIDTH = 720;
const HEIGHT = 420;
const PAD = { top: 36, right: 24, bottom: 48, left: 56 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

function toSvgX(x: number) {
  return PAD.left + x * PLOT_W;
}

function toSvgY(y: number) {
  return PAD.top + (1 - y) * PLOT_H;
}

export function TriageMap({
  points,
  missingCount,
  onSelect,
  onTriageMissing,
  selectedIssueNumber,
}: TriageMapProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const hoveredPoint = useMemo(
    () => points.find((p) => p.issueNumber === hovered) ?? null,
    [points, hovered],
  );

  if (points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/70 bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          No triaged issues to plot
        </p>
        <p className="max-w-md text-sm text-muted-foreground">
          Run AI triage on open issues to place them on the effort × confidence
          map. Good candidates for AI resolution cluster in the Quick Wins
          quadrant (high confidence, low effort).
        </p>
        {missingCount > 0 && onTriageMissing ? (
          <button
            type="button"
            onClick={onTriageMissing}
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Triage {missingCount} unscored issue
            {missingCount === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Good candidates for AI resolution sit in{" "}
        <span className="font-medium text-foreground">Quick Wins</span> (high
        confidence, low effort). High risk is shown with a stronger outline —
        confidence alone is not enough.
      </p>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="min-w-[36rem] w-full rounded-lg border border-border/60 bg-card"
          role="img"
          aria-label="Issue triage map: effort on X axis, AI confidence on Y axis"
        >
          {/* Quadrant backgrounds */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={PLOT_W / 2}
            height={PLOT_H / 2}
            className="fill-emerald-500/5"
          />
          <rect
            x={PAD.left + PLOT_W / 2}
            y={PAD.top}
            width={PLOT_W / 2}
            height={PLOT_H / 2}
            className="fill-sky-500/5"
          />
          <rect
            x={PAD.left}
            y={PAD.top + PLOT_H / 2}
            width={PLOT_W / 2}
            height={PLOT_H / 2}
            className="fill-muted/40"
          />
          <rect
            x={PAD.left + PLOT_W / 2}
            y={PAD.top + PLOT_H / 2}
            width={PLOT_W / 2}
            height={PLOT_H / 2}
            className="fill-amber-500/5"
          />

          {/* Mid lines */}
          <line
            x1={PAD.left + PLOT_W / 2}
            y1={PAD.top}
            x2={PAD.left + PLOT_W / 2}
            y2={PAD.top + PLOT_H}
            className="stroke-border"
            strokeDasharray="4 4"
          />
          <line
            x1={PAD.left}
            y1={PAD.top + PLOT_H / 2}
            x2={PAD.left + PLOT_W}
            y2={PAD.top + PLOT_H / 2}
            className="stroke-border"
            strokeDasharray="4 4"
          />

          {/* Axes */}
          <line
            x1={PAD.left}
            y1={PAD.top + PLOT_H}
            x2={PAD.left + PLOT_W}
            y2={PAD.top + PLOT_H}
            className="stroke-muted-foreground/40"
          />
          <line
            x1={PAD.left}
            y1={PAD.top}
            x2={PAD.left}
            y2={PAD.top + PLOT_H}
            className="stroke-muted-foreground/40"
          />

          <text
            x={PAD.left + PLOT_W / 2}
            y={HEIGHT - 12}
            textAnchor="middle"
            className="fill-muted-foreground text-[11px]"
          >
            Effort (S → L)
          </text>
          <text
            x={16}
            y={PAD.top + PLOT_H / 2}
            textAnchor="middle"
            transform={`rotate(-90 16 ${PAD.top + PLOT_H / 2})`}
            className="fill-muted-foreground text-[11px]"
          >
            AI confidence
          </text>

          {/* Quadrant labels */}
          <text
            x={PAD.left + PLOT_W * 0.25}
            y={PAD.top + 18}
            textAnchor="middle"
            className="fill-emerald-700/80 text-[11px] font-medium dark:fill-emerald-300/80"
          >
            Quick Wins
          </text>
          <text
            x={PAD.left + PLOT_W * 0.75}
            y={PAD.top + 18}
            textAnchor="middle"
            className="fill-sky-700/80 text-[11px] font-medium dark:fill-sky-300/80"
          >
            Big Bets
          </text>
          <text
            x={PAD.left + PLOT_W * 0.25}
            y={PAD.top + PLOT_H - 10}
            textAnchor="middle"
            className="fill-muted-foreground text-[11px] font-medium"
          >
            Skip
          </text>
          <text
            x={PAD.left + PLOT_W * 0.75}
            y={PAD.top + PLOT_H - 10}
            textAnchor="middle"
            className="fill-amber-700/80 text-[11px] font-medium dark:fill-amber-300/80"
          >
            Needs Human
          </text>

          {points.map((p) => {
            const cx = toSvgX(p.x);
            const cy = toSvgY(p.y);
            const selected = selectedIssueNumber === p.issueNumber;
            const isHover = hovered === p.issueNumber;
            return (
              <g key={p.issueNumber}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={p.radius + (selected || isHover ? 2 : 0)}
                  className={cn(
                    labelCategoryFillClass(p.labelCategory),
                    riskStrokeClass(p.risk),
                    p.stale && "opacity-60",
                    "cursor-pointer transition-opacity",
                  )}
                  strokeWidth={riskStrokeWidth(p.risk)}
                  onMouseEnter={() => setHovered(p.issueNumber)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onSelect(p.issueNumber)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(p.issueNumber);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Issue #${p.issueNumber}: ${p.title}. Confidence ${p.confidence}%, effort ${p.effort}, risk ${p.risk}${p.stale ? ", stale" : ""}`}
                />
                {p.stale ? (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={p.radius + 3}
                    className="pointer-events-none fill-none stroke-amber-500"
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                  />
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>

      {hoveredPoint ? (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">
              #{hoveredPoint.issueNumber} {hoveredPoint.title}
            </span>
            {hoveredPoint.stale ? (
              <Badge variant="outline" className="border-amber-500/40 text-amber-700">
                Stale
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-muted-foreground">
            Confidence {hoveredPoint.confidence}% · Effort {hoveredPoint.effort}{" "}
            · Risk {hoveredPoint.risk} · Age {formatAgeDays(hoveredPoint.ageDays)}
          </p>
          <p className="mt-1 text-foreground/90">{hoveredPoint.reason}</p>
          {hoveredPoint.labels.length > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Labels: {hoveredPoint.labels.join(", ")}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Hover a bubble for details. Click to open the issue panel. Bubble size
          ≈ issue age; outline weight ≈ risk.
        </p>
      )}

      {missingCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {missingCount} issue{missingCount === 1 ? "" : "s"} not plotted
          (missing or failed triage).
          {onTriageMissing ? (
            <>
              {" "}
              <button
                type="button"
                className="font-medium text-primary underline underline-offset-4"
                onClick={onTriageMissing}
              >
                Triage unscored
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-red-500/70" /> Bug
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-sky-500/70" /> Feature
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-emerald-500/70" /> Docs
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-violet-500/70" /> Security
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border-2 border-destructive bg-transparent" />{" "}
          High risk outline
        </span>
      </div>
    </div>
  );
}
