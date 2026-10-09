"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  defaultIssueFilters,
  type IssueFilterState,
  type TriageEffort,
  type TriageRisk,
} from "@/src/lib/triage/map";

const EFFORTS: TriageEffort[] = ["S", "M", "L"];
const RISKS: TriageRisk[] = ["low", "medium", "high"];

type IssueFiltersProps = {
  filters: IssueFilterState;
  onChange: (next: IssueFilterState) => void;
};

function toggleInList<T extends string>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export function IssueFilters({ filters, onChange }: IssueFiltersProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Effort</p>
        <div className="flex flex-wrap gap-1.5">
          {EFFORTS.map((e) => {
            const active = filters.efforts.includes(e);
            return (
              <Button
                key={e}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                className="h-7 px-2.5"
                onClick={() =>
                  onChange({
                    ...filters,
                    efforts: toggleInList(filters.efforts, e),
                  })
                }
              >
                {e}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Risk</p>
        <div className="flex flex-wrap gap-1.5">
          {RISKS.map((r) => {
            const active = filters.risks.includes(r);
            return (
              <Button
                key={r}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                className="h-7 px-2.5 capitalize"
                onClick={() =>
                  onChange({
                    ...filters,
                    risks: toggleInList(filters.risks, r),
                  })
                }
              >
                {r}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">
          Min confidence
        </p>
        <Input
          type="number"
          min={0}
          max={100}
          value={filters.minConfidence}
          className="h-8 w-24"
          onChange={(e) =>
            onChange({
              ...filters,
              minConfidence: Math.min(
                100,
                Math.max(0, Number(e.target.value) || 0),
              ),
            })
          }
        />
      </div>

      <div className="min-w-[10rem] flex-1 space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Label</p>
        <Input
          placeholder="e.g. bug"
          value={filters.labelQuery}
          className="h-8"
          onChange={(e) =>
            onChange({ ...filters, labelQuery: e.target.value })
          }
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8"
        onClick={() => onChange(defaultIssueFilters())}
      >
        Clear
      </Button>

      {(filters.efforts.length > 0 ||
        filters.risks.length > 0 ||
        filters.minConfidence > 0 ||
        filters.labelQuery.trim()) && (
        <Badge variant="secondary" className="h-7 self-center">
          Filters active
        </Badge>
      )}
    </div>
  );
}
