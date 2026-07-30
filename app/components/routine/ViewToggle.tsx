"use client";

import { LayoutGrid, Rows3, Table2 } from "lucide-react";

export type RoutineView = "grid" | "rail" | "table";

export function ViewToggle({ value, onChange }: { value: RoutineView; onChange: (v: RoutineView) => void }) {
  return (
    <div className="print:hidden inline-flex items-center rounded-md border border-border p-0.5 bg-muted/40">
      <button
        type="button"
        onClick={() => onChange("grid")}
        aria-pressed={value === "grid"}
        className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
          value === "grid" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <LayoutGrid className="size-3.5" aria-hidden="true" />
        Grid
      </button>
      <button
        type="button"
        onClick={() => onChange("rail")}
        aria-pressed={value === "rail"}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
          value === "rail" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Rows3 className="size-3.5" aria-hidden="true" />
        List
      </button>
      <button
        type="button"
        onClick={() => onChange("table")}
        aria-pressed={value === "table"}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
          value === "table" ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Table2 className="size-3.5" aria-hidden="true" />
        Table
      </button>
    </div>
  );
}
