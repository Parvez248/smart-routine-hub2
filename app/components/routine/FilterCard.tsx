"use client";

import { RoutineFilterBar } from "./RoutineFilterBar";
import type { useRoutineFilters } from "./useRoutineFilters";

// Frosted glass, sticky below the app header while scrolling a long routine.
// z-40 — below any dropdown/popover menu (z-50), per the documented scale.
export function FilterCard({
  state, totalCount,
}: {
  state: ReturnType<typeof useRoutineFilters>;
  totalCount: number;
}) {
  const { filtered, clearAll, activeCount } = state;

  return (
    <div className="glass print:hidden sticky top-28 z-40 rounded-lg overflow-visible">
      <div className="border-b border-border px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-heading text-base font-semibold text-foreground">Filters</h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-data">
            Showing {filtered.length} of {totalCount} classes
          </p>
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset
          </button>
        )}
      </div>
      <div className="px-6 py-4">
        <RoutineFilterBar state={state} />
      </div>
    </div>
  );
}
