import {
  Table as ShadcnTable,
  TableHeader as ShadcnTableHeader,
  TableRow as ShadcnTableRow,
  TableHead as ShadcnTableHead,
  TableBody as ShadcnTableBody,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ColumnHeader = string | { label: React.ReactNode; className?: string };

export function Table({
  headers,
  children,
}: {
  headers: ColumnHeader[];
  children: React.ReactNode;
}) {
  return (
    <ShadcnTable className="w-full text-sm">
      <ShadcnTableHeader className="sticky top-0 z-20 bg-canvas">
        <ShadcnTableRow className="bg-canvas hover:bg-canvas border-border">
          {headers.map((h, i) => {
            const label = typeof h === "string" ? h : h.label;
            const className = typeof h === "string" ? "" : h.className ?? "";
            return (
              <ShadcnTableHead
                key={i}
                className={cn("px-5 py-3 h-auto text-left font-semibold text-slate text-xs uppercase tracking-wide whitespace-normal", className)}
              >
                {label}
              </ShadcnTableHead>
            );
          })}
        </ShadcnTableRow>
      </ShadcnTableHeader>
      <ShadcnTableBody className="[&_tr]:border-border">{children}</ShadcnTableBody>
    </ShadcnTable>
  );
}
