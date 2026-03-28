import { ReactNode } from "react";

import { SectionCard } from "@/components/section-card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function DataTable({
  title,
  description,
  action,
  columns,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  columns: string[];
  children: ReactNode;
}) {
  return (
    <SectionCard title={title} description={description} action={action} contentClassName="p-0">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </SectionCard>
  );
}
