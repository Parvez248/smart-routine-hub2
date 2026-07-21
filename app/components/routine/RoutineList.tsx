"use client";

import { useMemo, useState } from "react";
import { Table } from "@/app/components/ui/Table";
import { EmptyState } from "@/app/components/ui/EmptyState";
import type { FilterableSession } from "./types";

type SortKey = "day" | "course" | "teacher" | "batch" | "room" | "status";
const DAY_ORDER = ["Sat", "Sun", "Mon", "Tues", "Wed"];

function formatMovedDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function MovedBadge({ movedTo }: { movedTo: FilterableSession["movedTo"] }) {
  if (!movedTo) return null;
  return (
    <div className="mt-1 text-xs font-normal text-amber-700">
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 mr-1">
        {movedTo.date ? `Moved on ${formatMovedDate(movedTo.date)}` : "Moved"}
      </span>
      to {movedTo.day}, {movedTo.timeSlot?.label}, Room {movedTo.room?.name}
    </div>
  );
}

function SortHead({ label, active, dir, onClick }: { label: string; active: boolean; dir: 1 | -1; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 font-semibold hover:text-gray-600 transition-colors">
      {label} {active && <span>{dir === 1 ? "↑" : "↓"}</span>}
    </button>
  );
}

export function RoutineList<T extends FilterableSession>({
  sessions, renderActions, onClearFilters,
}: {
  sessions: T[];
  renderActions?: (s: T) => React.ReactNode;
  onClearFilters?: () => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("day");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  const sorted = useMemo(() => {
    const arr = [...sessions];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "day":
          cmp = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.timeSlot.sortOrder - b.timeSlot.sortOrder;
          break;
        case "course":
          cmp = a.course.code.localeCompare(b.course.code);
          break;
        case "teacher":
          cmp = a.teacher.initials.localeCompare(b.teacher.initials);
          break;
        case "batch":
          cmp = a.batch.name.localeCompare(b.batch.name);
          break;
        case "room":
          cmp = a.room.name.localeCompare(b.room.name);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return cmp * sortDir;
    });
    return arr;
  }, [sessions, sortKey, sortDir]);

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon="🔍"
        message="No classes match these filters."
        action={
          onClearFilters ? (
            <button type="button" onClick={onClearFilters} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
              Clear all filters
            </button>
          ) : undefined
        }
      />
    );
  }

  const headers = [
    { label: <SortHead label="Day / Slot" active={sortKey === "day"} dir={sortDir} onClick={() => toggleSort("day")} /> },
    { label: <SortHead label="Course" active={sortKey === "course"} dir={sortDir} onClick={() => toggleSort("course")} /> },
    { label: <SortHead label="Teacher" active={sortKey === "teacher"} dir={sortDir} onClick={() => toggleSort("teacher")} /> },
    { label: <SortHead label="Batch / Section" active={sortKey === "batch"} dir={sortDir} onClick={() => toggleSort("batch")} /> },
    { label: <SortHead label="Room" active={sortKey === "room"} dir={sortDir} onClick={() => toggleSort("room")} /> },
    { label: <SortHead label="Status" active={sortKey === "status"} dir={sortDir} onClick={() => toggleSort("status")} /> },
    ...(renderActions ? [{ label: "" }] : []),
  ];

  return (
    <Table headers={headers}>
      {sorted.map((s) => {
        const cancelled = s.status === "CANCELLED";
        return (
          <tr key={s.id} className={`hover:bg-slate-50 transition-colors group ${cancelled ? "bg-gray-50/60 opacity-60" : ""}`}>
            <td className="px-5 py-3.5 whitespace-nowrap">
              <span className="font-semibold text-gray-700">{s.day}</span>
              <div className="text-xs text-gray-500">{s.timeSlot.label}</div>
            </td>
            <td className="px-5 py-3.5 font-semibold text-gray-800">
              {s.course.code}
              {cancelled && (
                <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                  Cancelled
                </span>
              )}
              {!cancelled && <MovedBadge movedTo={s.movedTo} />}
            </td>
            <td className="px-5 py-3.5">
              <span className="font-medium text-gray-700">{s.teacher.initials}</span>
              <span className="ml-1.5 text-xs text-gray-400 hidden sm:inline">{s.teacher.name}</span>
            </td>
            <td className="px-5 py-3.5">
              <span className="font-medium text-gray-700">{s.batch.name}</span>
              {s.section && <span className="ml-1.5 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{s.section}</span>}
            </td>
            <td className="px-5 py-3.5 text-gray-600">{s.room.name}</td>
            <td className="px-5 py-3.5">
              {cancelled ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Cancelled</span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Active</span>
              )}
            </td>
            {renderActions && <td className="px-5 py-3.5 text-right whitespace-nowrap">{renderActions(s)}</td>}
          </tr>
        );
      })}
    </Table>
  );
}
