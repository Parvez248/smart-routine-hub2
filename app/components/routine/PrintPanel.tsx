"use client";

import { Printer } from "lucide-react";

export function PrintButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      aria-label="Print this routine"
      className={`print:hidden inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors focus-visible:outline-none ${className}`}
    >
      <Printer className="size-3.5" aria-hidden="true" />
      Print
    </button>
  );
}

export function PrintHeader({ subtitle, filterSummary }: { subtitle: string; filterSummary?: string }) {
  return (
    <div className="hidden print:block px-6 pt-6 pb-2">
      <h1 className="text-base font-bold">Routine Management System — Hamdard University Bangladesh, Dept. of CSE</h1>
      <p className="text-sm mt-0.5">{subtitle}</p>
      <p className="text-xs mt-0.5">Filters: {filterSummary && filterSummary.length > 0 ? filterSummary : "None"}</p>
      <p className="text-xs mt-0.5">Printed: {new Date().toLocaleString()}</p>
    </div>
  );
}
