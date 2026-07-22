"use client";

import { Suspense, useEffect, useState } from "react";
import { Loading } from "@/app/components/ui/Loading";
import { useRoutineFilters } from "@/app/components/routine/useRoutineFilters";
import { RoutineList } from "@/app/components/routine/RoutineList";
import { RoutineTimeRail } from "@/app/components/routine/RoutineTimeRail";
import { RoutineMasthead } from "@/app/components/routine/RoutineMasthead";
import { FilterCard } from "@/app/components/routine/FilterCard";
import { ViewToggle, type RoutineView } from "@/app/components/routine/ViewToggle";
import type { FilterableSession } from "@/app/components/routine/types";

type RoutineSession = FilterableSession & { id: number };

function TeacherRoutineInner() {
  const [sessions, setSessions] = useState<RoutineSession[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [view, setView] = useState<RoutineView>("rail");

  useEffect(() => {
    document.title = "Full Routine · Routine Management System";
  }, []);

  useEffect(() => {
    fetch("/api/teacher/routine")
      .then((res) => res.json())
      .then((json) => { if (json.ok) setSessions(json.data); })
      .finally(() => setLoadingState(false));
  }, []);

  const filterState = useRoutineFilters(sessions, { storageKey: "teacher" });
  const { filtered, totalCount, clearAll } = filterState;

  return (
    <>
      <RoutineMasthead filterSummary={filterState.chips.map((c) => c.label).join(", ")} />

      <FilterCard state={filterState} totalCount={totalCount} />

      <div className="print:hidden flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Every published class across all batches — read-only. This is not just your own classes.
        </p>
        <ViewToggle value={view} onChange={setView} />
      </div>

      {view === "rail" ? (
        <RoutineTimeRail sessions={filtered} loading={loading} onClearFilters={clearAll} />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <RoutineList sessions={filtered} loading={loading} onClearFilters={clearAll} />
        </div>
      )}
    </>
  );
}

export default function TeacherRoutinePage() {
  return (
    <Suspense fallback={<Loading />}>
      <TeacherRoutineInner />
    </Suspense>
  );
}
