"use client";

import { Suspense, useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Loading } from "@/app/components/ui/Loading";
import { useRoutineFilters } from "@/app/components/routine/useRoutineFilters";
import { RoutineFilterBar } from "@/app/components/routine/RoutineFilterBar";
import { RoutineGrid } from "@/app/components/routine/RoutineGrid";
import { RoutineList } from "@/app/components/routine/RoutineList";
import type { FilterableSession } from "@/app/components/routine/types";

type RoutineSession = FilterableSession & { id: number };

function TeacherRoutineInner() {
  const [sessions, setSessions] = useState<RoutineSession[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [myInitials, setMyInitials] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/teacher/routine")
      .then((res) => res.json())
      .then((json) => { if (json.ok) setSessions(json.data); })
      .finally(() => setLoadingState(false));

    fetch("/api/teacher/classes")
      .then((res) => res.json())
      .then((json) => { if (json.ok && json.data[0]) setMyInitials(json.data[0].teacher?.initials ?? null); });
  }, []);

  const filterState = useRoutineFilters(sessions, { storageKey: "teacher", currentTeacherInitials: myInitials });
  const { filtered, filteredStats, totalCount, view, clearAll } = filterState;

  return (
    <>
      <PageHeader
        title="Full Department Routine"
        description="Every published class across all batches — read-only. This is not just your own classes."
      />

      <Card>
        <CardHeader title="Routine" />

        <div className="px-6 py-4 border-b border-gray-100">
          <RoutineFilterBar state={filterState} showMyClassesPreset freeRoomsHref="/teacher/free-rooms" />
        </div>

        <div className="px-6 py-3 text-xs text-gray-400">
          Showing {filtered.length} of {totalCount} classes
          {filteredStats.cancelled > 0 && ` · ${filteredStats.cancelled} cancelled`}
          {filteredStats.rescheduled > 0 && ` · ${filteredStats.rescheduled} rescheduled`}
        </div>

        {loading ? (
          <Loading />
        ) : view === "grid" ? (
          <div className="px-6 pb-6">
            <RoutineGrid sessions={filtered} onClearFilters={clearAll} />
          </div>
        ) : (
          <RoutineList sessions={filtered} onClearFilters={clearAll} />
        )}
      </Card>
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
