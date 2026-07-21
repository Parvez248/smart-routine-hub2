"use client";

import { Fragment, useMemo, useState } from "react";
import { Table } from "@/app/components/ui/Table";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { DAY_NAME, DAY_ORDER, dayGradient, daySpineClass } from "@/lib/ui/dayColors";
import type { FilterableSession } from "./types";

type SortKey = "day" | "slot" | "course" | "teacher" | "batch" | "room" | "status";

function TypePill({ type, day }: { type: string; day: string }) {
  const isLab = type === "LAB";
  return (
    <span
      className={
        isLab
          ? "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white print:text-foreground print:border print:border-foreground"
          : "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border border-slate text-slate print:border-foreground print:text-foreground"
      }
      style={isLab ? { backgroundImage: dayGradient(day) } : undefined}
    >
      {isLab ? "LAB" : "THEORY"}
    </span>
  );
}

function formatMovedDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function MovedNote({ movedTo }: { movedTo: FilterableSession["movedTo"] }) {
  if (!movedTo) return null;
  return (
    <div className="mt-1 text-xs font-normal text-moved">
      → {movedTo.date ? `${formatMovedDate(movedTo.date)}, ` : ""}
      {movedTo.day}, {movedTo.timeSlot?.label}, Room {movedTo.room?.name}
    </div>
  );
}

function SortHead({ label, active, dir, onClick }: { label: string; active: boolean; dir: 1 | -1; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 font-semibold hover:text-foreground transition-colors">
      {label} {active && <span>{dir === 1 ? "↑" : "↓"}</span>}
    </button>
  );
}

// Every row keeps a day-coloured spine — status always wins over day colour,
// so a cancelled/moved class stays visible even inside its day's colour block.
function stripeShadow(day: string, cancelled: boolean, moved: boolean): string {
  if (cancelled) return "shadow-[inset_4px_0_0_0_var(--cancelled)]";
  if (moved) return "shadow-[inset_4px_0_0_0_var(--moved)]";
  return daySpineClass(day);
}

function SkeletonRows({ columns }: { columns: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-border">
          {Array.from({ length: columns }).map((__, j) => (
            <td key={j} className="px-5 py-3.5">
              <Skeleton className="h-4 w-full max-w-[120px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function RoutineList<T extends FilterableSession>({
  sessions, renderActions, onClearFilters, loading = false,
}: {
  sessions: T[];
  renderActions?: (s: T) => React.ReactNode;
  onClearFilters?: () => void;
  loading?: boolean;
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
        case "slot":
          cmp = a.timeSlot.sortOrder - b.timeSlot.sortOrder;
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

  const headers = [
    { label: <SortHead label="Day" active={sortKey === "day"} dir={sortDir} onClick={() => toggleSort("day")} /> },
    { label: <SortHead label="Time Slot" active={sortKey === "slot"} dir={sortDir} onClick={() => toggleSort("slot")} /> },
    { label: <SortHead label="Course" active={sortKey === "course"} dir={sortDir} onClick={() => toggleSort("course")} /> },
    { label: <SortHead label="Teacher" active={sortKey === "teacher"} dir={sortDir} onClick={() => toggleSort("teacher")} /> },
    { label: <SortHead label="Batch / Section" active={sortKey === "batch"} dir={sortDir} onClick={() => toggleSort("batch")} /> },
    { label: <SortHead label="Room" active={sortKey === "room"} dir={sortDir} onClick={() => toggleSort("room")} /> },
    { label: <SortHead label="Status" active={sortKey === "status"} dir={sortDir} onClick={() => toggleSort("status")} /> },
    ...(renderActions ? [{ label: <span className="print:hidden"></span> }] : []),
  ];

  if (loading) {
    return (
      <Table headers={headers}>
        <SkeletonRows columns={headers.length} />
      </Table>
    );
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon="🔍"
        message="No classes match these filters."
        action={
          onClearFilters ? (
            <button type="button" onClick={onClearFilters} className="text-xs font-semibold text-primary hover:opacity-80">
              Clear all filters
            </button>
          ) : undefined
        }
      />
    );
  }

  const grouped = sortKey === "day";
  let lastDay: string | null = null;

  return (
    <Table headers={headers}>
      {sorted.map((s) => {
        const cancelled = s.status === "CANCELLED";
        const moved = !cancelled && Boolean(s.movedTo);
        const showDayHeader = grouped && s.day !== lastDay;
        if (showDayHeader) lastDay = s.day;
        const dayCount = grouped ? sorted.filter((x) => x.day === s.day).length : 0;

        return (
          <Fragment key={s.id}>
            {showDayHeader && (
              <tr key={`day-${s.day}`} className="hover:bg-transparent">
                <td colSpan={headers.length} className="p-0">
                  <div
                    className="on-gradient print:bg-white flex items-center gap-2 px-5 py-2"
                    style={{ backgroundImage: dayGradient(s.day) }}
                  >
                    <span className="font-heading font-bold text-white text-xs uppercase tracking-wide print:text-foreground">
                      {DAY_NAME[s.day as keyof typeof DAY_NAME] ?? s.day}
                    </span>
                    <span className="text-white/90 text-[11px] font-semibold bg-white/20 px-2 py-0.5 rounded-full print:hidden">
                      {dayCount} classes
                    </span>
                    <span className="hidden print:inline text-[11px] text-muted-foreground">· {dayCount} classes</span>
                  </div>
                </td>
              </tr>
            )}
            <tr key={s.id} className={`hover:bg-muted/40 transition-colors group ${cancelled ? "text-muted-foreground" : ""}`}>
              <td className={`px-5 py-3.5 font-semibold font-data whitespace-nowrap ${stripeShadow(s.day, cancelled, moved)}`}>{s.day}</td>
              <td className="px-5 py-3.5 text-muted-foreground font-data whitespace-nowrap">{s.timeSlot.label}</td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-1.5">
                  <span className={`font-semibold font-heading ${cancelled ? "text-muted-foreground line-through" : "text-foreground"}`}>{s.course.code}</span>
                  <TypePill type={s.course.type} day={s.day} />
                </div>
                <div className="text-xs text-slate truncate max-w-[180px]" title={s.course.title}>{s.course.title}</div>
                {cancelled && <StatusBadge status="Cancelled" className="mt-1" />}
                {moved && (
                  <>
                    <StatusBadge status="Moved" className="mt-1" />
                    <MovedNote movedTo={s.movedTo} />
                  </>
                )}
              </td>
              <td className="px-5 py-3.5">
                <span className="font-medium font-data text-foreground">{s.teacher.initials}</span>
                <span className="ml-1.5 text-xs text-slate hidden sm:inline">{s.teacher.name}</span>
              </td>
              <td className="px-5 py-3.5">
                <span className="font-medium text-foreground">{s.batch.name}</span>
                {s.section && <span className="ml-1.5 text-xs text-slate bg-muted px-1.5 py-0.5 rounded">{s.section}</span>}
              </td>
              <td className="px-5 py-3.5 text-muted-foreground font-data">{s.room.name}</td>
              <td className="px-5 py-3.5">
                <StatusBadge status={cancelled ? "Cancelled" : "Active"} />
              </td>
              {renderActions && <td className="print:hidden px-5 py-3.5 text-right whitespace-nowrap">{renderActions(s)}</td>}
            </tr>
          </Fragment>
        );
      })}
    </Table>
  );
}
