"use client";

/**
 * Student "Full Routine" — the whole published department routine, every
 * batch, read-only (Step 48). The counterpart to /student/routine, which
 * shows only the student's own batch; RoutineScopeTabs switches between them.
 *
 * Data comes from the existing public GET /api/sessions — the same
 * all-batches read path the admin Schedule tab uses, which defaults to the
 * published version and attaches each session's active reschedule override
 * as `movedTo`. No new endpoint was added for this page: the student-only
 * route (/api/student/routine) returns one batch at a time, and the
 * teacher Full Routine route is teacher-gated, so /api/sessions is the
 * existing path that answers "every batch" for a student.
 *
 * Read-only by construction: `editable` is never passed to the shared
 * routine components, so no add/edit/delete/combine affordances render —
 * and the API would refuse those writes from a student regardless.
 */
import { Suspense, useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Loading } from "@/app/components/ui/Loading";
import { useRoutineFilters } from "@/app/components/routine/useRoutineFilters";
import { RoutineList } from "@/app/components/routine/RoutineList";
import { RoutineTimeRail } from "@/app/components/routine/RoutineTimeRail";
import { RoutineGrid } from "@/app/components/routine/RoutineGrid";
import { RoutineMasthead } from "@/app/components/routine/RoutineMasthead";
import { FilterCard } from "@/app/components/routine/FilterCard";
import { ViewToggle, type RoutineView } from "@/app/components/routine/ViewToggle";
import { useIsDesktop } from "@/app/components/routine/useIsDesktop";
import { RoutineScopeTabs } from "@/app/student/_components/RoutineScopeTabs";
import type { FilterableSession } from "@/app/components/routine/types";

type RoutineSession = FilterableSession & { id: number };

function StudentFullRoutineInner() {
  const [sessions, setSessions] = useState<RoutineSession[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<RoutineView>("grid");
  const isDesktop = useIsDesktop();
  const effectiveView: RoutineView = view === "table" ? "table" : isDesktop ? view : "rail";

  useEffect(() => {
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((json) => {
        if (json.ok) setSessions(json.data);
        else setError(json.error ?? "Failed to load the routine.");
      })
      .catch(() => setError("Network error. Please try again."))
      .finally(() => setLoadingState(false));
  }, []);

  const filterState = useRoutineFilters(sessions, { storageKey: "student-full" });
  const { filtered, totalCount, clearAll } = filterState;

  return (
    <>
      <PageHeader
        title="Full Routine"
        description="All batches — read-only"
        action={<RoutineScopeTabs active="full" />}
      />

      <RoutineMasthead filterSummary={filterState.chips.map((c) => c.label).join(", ")} />

      <FilterCard state={filterState} totalCount={totalCount} />

      <div className="print:hidden flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground">
          Every published class across all batches — read-only. Use the filters to narrow it down.
        </p>
        <ViewToggle value={view} onChange={setView} />
      </div>

      {error ? (
        <div className="glass rounded-lg overflow-hidden">
          <div className="px-6 py-16 text-center">
            <p className="text-muted-foreground/50 text-4xl mb-3">⚠️</p>
            <p className="text-cancelled text-sm">{error}</p>
          </div>
        </div>
      ) : effectiveView === "grid" ? (
        <RoutineGrid sessions={filtered} loading={loading} onClearFilters={clearAll} />
      ) : effectiveView === "rail" ? (
        <RoutineTimeRail sessions={filtered} loading={loading} onClearFilters={clearAll} />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <RoutineList sessions={filtered} loading={loading} onClearFilters={clearAll} />
        </div>
      )}
    </>
  );
}

export default function StudentFullRoutinePage() {
  return (
    <Suspense fallback={<Loading />}>
      <StudentFullRoutineInner />
    </Suspense>
  );
}
