"use client";

import { LoaderCircle, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatAgeDays, ageDaysFromCreatedAt } from "@/src/lib/triage/map";

export type IssueDetailSheetIssue = {
  number: number;
  title: string;
  body: string;
  url: string;
  labels: string[];
  createdAt: string;
  triage: {
    confidence: number;
    effort: "S" | "M" | "L";
    risk: "low" | "medium" | "high";
    reason: string;
    stale: boolean;
    errorMsg: string | null;
  } | null;
};

type IssueDetailSheetProps = {
  issue: IssueDetailSheetIssue | null;
  open: boolean;
  onClose: () => void;
  onResolve: () => void;
  onTriage: () => void;
  isTriggering?: boolean;
  isTriaging?: boolean;
};

export function IssueDetailSheet({
  issue,
  open,
  onClose,
  onResolve,
  onTriage,
  isTriggering,
  isTriaging,
}: IssueDetailSheetProps) {
  const age = issue
    ? formatAgeDays(ageDaysFromCreatedAt(issue.createdAt))
    : "";

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md">
        {issue ? (
          <>
            <SheetHeader>
              <SheetTitle>
                #{issue.number} {issue.title}
              </SheetTitle>
              <SheetDescription>
                Age {age}. Open the full resolve flow or re-run triage without
                leaving the map.
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-2">
              {issue.triage && !issue.triage.errorMsg ? (
                <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary">
                      Confidence {issue.triage.confidence}%
                    </Badge>
                    <Badge variant="outline">Effort {issue.triage.effort}</Badge>
                    <Badge
                      variant="outline"
                      className={
                        issue.triage.risk === "high"
                          ? "border-destructive/40 text-destructive"
                          : undefined
                      }
                    >
                      Risk {issue.triage.risk}
                    </Badge>
                    {issue.triage.stale ? (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 text-amber-700"
                      >
                        Stale
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground">{issue.triage.reason}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {issue.triage?.errorMsg
                    ? `Triage failed: ${issue.triage.errorMsg}`
                    : "Not triaged yet. Run triage to score this issue for the map."}
                </p>
              )}

              {issue.labels.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {issue.labels.map((label) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                </div>
              ) : null}

              {issue.body ? (
                <p className="line-clamp-6 whitespace-pre-wrap text-sm text-muted-foreground">
                  {issue.body}
                </p>
              ) : null}

              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-primary underline underline-offset-4"
              >
                View on GitHub
              </a>
            </div>

            <SheetFooter>
              <Button
                variant="outline"
                onClick={onTriage}
                disabled={isTriaging}
              >
                {isTriaging ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {issue.triage ? "Re-triage" : "Triage"}
              </Button>
              <Button onClick={onResolve} disabled={isTriggering}>
                {isTriggering ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : null}
                Resolve with AI
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
