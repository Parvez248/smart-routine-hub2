"use client";

import { Fragment, useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { bandForBatch, bandTint, bandVar, type Band } from "@/lib/ui/bandColors";
import { BatchPill, courseTitleIfDifferent, formatMovedDate } from "./RowBadges";
import type { FilterableSession } from "./types";

const DAY_ORDER = ["Sat", "Sun", "Mon", "Tues", "Wed"];
const DAY_NAME: Record<string, string> = { Sat: "Saturday", Sun: "Sunday", Mon: "Monday", Tues: "Tuesday", Wed: "Wednesday" };

const DAY_COL_WIDTH = 56;
const YEAR_COL_WIDTH = 168;
const BREAK_COL_WIDTH = 28;
const SLOT_COL_WIDTH = 132;

type SlotColumn = { sortOrder: number; label: string };
type Cell<T> = { session: T; span: 1 | 2 } | { session: T; span: 0 } | null;

type Row<T> = {
  day: string;
  batch: T extends FilterableSession ? T["batch"] : never;
  section: string | null;
  sortKey: number;
  sessions: T[];
};

// A LAB class occupying two adjacent time slots is stored as two ordinary
// Session rows (the schema has one timeSlotId per row — see lib/services);
// this only recognises that pattern for display and merges the two cells
// into one wide one. It never merges across the BREAK column.
function sameClass<T extends FilterableSession>(a: T, b: T): boolean {
  if (a.course.type !== "LAB" || b.course.type !== "LAB") return false;
  if (a.course.code !== b.course.code) return false;
  if (a.teacher.initials !== b.teacher.initials) return false;
  if (a.room.name !== b.room.name) return false;
  if (a.status !== b.status) return false;
  const am = a.movedTo;
  const bm = b.movedTo;
  if (Boolean(am) !== Boolean(bm)) return false;
  if (am && bm) {
    if (am.day !== bm.day || am.date !== bm.date) return false;
    if ((am.timeSlot?.label ?? null) !== (bm.timeSlot?.label ?? null)) return false;
    if ((am.room?.name ?? null) !== (bm.room?.name ?? null)) return false;
  }
  return true;
}

function buildCells<T extends FilterableSession>(sessions: T[], slots: SlotColumn[], breakAfterIndex: number): Cell<T>[] {
  const cells: Cell<T>[] = new Array(slots.length).fill(null);
  for (const s of sessions) {
    const idx = slots.findIndex((c) => c.sortOrder === s.timeSlot.sortOrder);
    if (idx !== -1 && !cells[idx]) cells[idx] = { session: s, span: 1 };
  }
  for (let i = 0; i < slots.length - 1; i++) {
    if (i === breakAfterIndex) continue;
    const a = cells[i];
    const b = cells[i + 1];
    if (!a || !b || a.span !== 1 || b.span !== 1) continue;
    if (sameClass(a.session, b.session)) {
      cells[i] = { session: a.session, span: 2 };
      cells[i + 1] = { session: a.session, span: 0 };
    }
  }
  return cells;
}

function GridCell<T extends FilterableSession>({ cell, band, span }: { cell: Cell<T>; band: Band; span: number }) {
  if (!cell) {
    return (
      <td
        className="grid-empty-cell border border-border p-0"
        style={{ width: SLOT_COL_WIDTH, backgroundColor: bandTint(band, 6) }}
      />
    );
  }

  const s = cell.session;
  const cancelled = s.status === "CANCELLED";
  const moved = !cancelled && Boolean(s.movedTo);
  const fill = cancelled ? "var(--bar-cancelled)" : moved ? "var(--bar-moved)" : bandVar(band);
  const title = courseTitleIfDifferent(s.course);

  return (
    <td colSpan={span} className="border border-border p-1 align-top" style={{ width: SLOT_COL_WIDTH * span }}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              className="on-band w-full h-full min-h-14 rounded-md px-2 py-1.5 flex flex-col justify-center gap-0.5 text-left cursor-default print:border print:border-foreground"
              style={{ backgroundColor: fill }}
            />
          }
        >
          <span className={`font-data font-semibold text-[11px] leading-tight tabular truncate text-white ${cancelled ? "line-through" : ""}`}>
            {s.course.code}
          </span>
          <span className="text-[10px] leading-tight tabular text-white/85 truncate">
            {s.teacher.initials} · R{s.room.name}
          </span>
          {cancelled && <span className="text-[9px] font-bold uppercase tracking-wide text-white/90 truncate">Cancelled</span>}
          {moved && <span className="text-[9px] font-bold uppercase tracking-wide text-white/90 truncate">Moved</span>}
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">{s.teacher.name}</p>
          <p>{s.course.code}{title ? ` — ${title}` : ""}</p>
          <p>Room {s.room.name}</p>
          {moved && s.movedTo && (
            <p className="mt-1 text-muted-foreground">
              Moved to {s.movedTo.date ? `${formatMovedDate(s.movedTo.date)}, ` : ""}
              {s.movedTo.day}, {s.movedTo.timeSlot?.label}, Room {s.movedTo.room?.name}
            </p>
          )}
          {cancelled && <p className="mt-1 text-muted-foreground">Cancelled</p>}
        </TooltipContent>
      </Tooltip>
    </td>
  );
}

function GridSkeleton() {
  return (
    <div className="glass rounded-lg p-5">
      <Skeleton className="h-8 w-full mb-3" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full mb-2" />
      ))}
    </div>
  );
}

export function RoutineGrid<T extends FilterableSession>({
  sessions, onClearFilters, loading = false,
}: {
  sessions: T[];
  onClearFilters?: () => void;
  loading?: boolean;
}) {
  const slotColumns = useMemo<SlotColumn[]>(() => {
    const map = new Map<number, string>();
    for (const s of sessions) map.set(s.timeSlot.sortOrder, s.timeSlot.label);
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([sortOrder, label]) => ({ sortOrder, label }));
  }, [sessions]);

  const breakAfterIndex = slotColumns.length >= 5 ? 3 : -1;

  const rows = useMemo(() => {
    const map = new Map<string, Row<T>>();
    for (const s of sessions) {
      const key = `${s.day}|${s.batch.name}|${s.batch.semester}|${s.section ?? ""}`;
      if (!map.has(key)) {
        const n = parseInt(s.batch.semester.match(/\d+/)?.[0] ?? "0", 10);
        map.set(key, { day: s.day, batch: s.batch as Row<T>["batch"], section: s.section, sortKey: n, sessions: [] });
      }
      map.get(key)!.sessions.push(s);
    }
    return [...map.values()].sort(
      (a, b) =>
        DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) ||
        b.sortKey - a.sortKey ||
        a.batch.name.localeCompare(b.batch.name)
    );
  }, [sessions]);

  const dayRowSpans = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.day, (counts.get(r.day) ?? 0) + 1);
    return counts;
  }, [rows]);

  if (loading) return <GridSkeleton />;

  if (sessions.length === 0) {
    return (
      <div className="glass rounded-lg overflow-hidden">
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
      </div>
    );
  }

  let lastDay: string | null = null;

  return (
    <TooltipProvider>
      <div className="glass rounded-lg overflow-hidden">
        <div className="grid-scroll-area overflow-auto max-h-[75vh]">
          <table className="border-collapse text-sm" style={{ tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: DAY_COL_WIDTH }} />
              <col style={{ width: YEAR_COL_WIDTH }} />
              {slotColumns.map((col, i) => (
                <Fragment key={col.sortOrder}>
                  {i === breakAfterIndex + 1 && <col style={{ width: BREAK_COL_WIDTH }} />}
                  <col style={{ width: SLOT_COL_WIDTH }} />
                </Fragment>
              ))}
            </colgroup>
            <thead>
              <tr>
                <th
                  className="grid-sticky sticky top-0 z-30 border border-border bg-card"
                  style={{ left: 0 }}
                  aria-hidden="true"
                />
                <th
                  className="grid-sticky sticky top-0 z-30 border border-border bg-card px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  style={{ left: DAY_COL_WIDTH }}
                >
                  Year
                </th>
                {slotColumns.map((col, i) => (
                  <Fragment key={col.sortOrder}>
                    {i === breakAfterIndex + 1 && (
                      <th className="grid-sticky sticky top-0 z-20 border border-border bg-muted p-0" rowSpan={1} />
                    )}
                    <th className="grid-sticky sticky top-0 z-20 border border-border bg-card px-2 py-2 text-center font-data text-[11px] tabular font-semibold text-muted-foreground whitespace-nowrap">
                      {col.label}
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => {
                const band = bandForBatch(row.batch);
                const cells = buildCells(row.sessions, slotColumns, breakAfterIndex);
                const showDay = row.day !== lastDay;
                if (showDay) lastDay = row.day;
                const daySpan = dayRowSpans.get(row.day) ?? 1;

                return (
                  <tr key={`${row.day}-${row.batch.name}-${row.batch.semester}-${row.section ?? ""}`} className="break-inside-avoid">
                    {showDay && (
                      <td
                        className="grid-sticky sticky z-10 border border-border bg-card text-center align-middle"
                        style={{ left: 0 }}
                        rowSpan={daySpan}
                      >
                        <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-1 text-[11px] font-semibold text-foreground">
                          {row.day}
                        </span>
                      </td>
                    )}
                    <td className="grid-sticky sticky z-10 border border-border bg-card px-2 py-1.5" style={{ left: DAY_COL_WIDTH }}>
                      <BatchPill batch={row.batch} section={row.section} />
                    </td>
                    {(() => {
                      const out: React.ReactNode[] = [];
                      for (let i = 0; i < slotColumns.length; i++) {
                        if (i === breakAfterIndex + 1 && rIdx === 0) {
                          out.push(
                            <td
                              key="break"
                              rowSpan={rows.length}
                              className="border border-border bg-muted p-0 text-center align-top"
                            >
                              {/* Sticky so the label stays legible while scrolling a tall grid —
                                  the cell spans every row via rowSpan, so a plain centered label
                                  would only be visible for one section of a long table. */}
                              <span className="sticky top-8 mt-2 inline-block [writing-mode:vertical-rl] rotate-180 text-[9px] font-bold tracking-wide text-muted-foreground whitespace-nowrap">
                                BREAK · PRAYER
                              </span>
                            </td>
                          );
                        }
                        const cell = cells[i];
                        if (cell && cell.span === 0) continue;
                        out.push(<GridCell key={slotColumns[i].sortOrder} cell={cell} band={band} span={cell?.span ?? 1} />);
                      }
                      return out;
                    })()}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </TooltipProvider>
  );
}
