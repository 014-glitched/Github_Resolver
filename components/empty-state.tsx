import { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("border-dashed bg-muted/15", className)}>
      <CardContent className="flex flex-col items-center gap-4 px-6 py-12 text-center sm:px-10">
        <div className="flex size-12 items-center justify-center rounded-xl border border-border/70 bg-background text-muted-foreground shadow-sm">
          {icon}
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">{title}</p>
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}
