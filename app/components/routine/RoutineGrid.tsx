"use client";

import { Fragment, useMemo } from "react";
import { Pencil, Trash2, Plus, Combine } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { bandForBatch, bandTint, bandVar, type Band } from "@/lib/ui/bandColors";
import { BatchPill, courseTitleIfDifferent, formatMovedDate } from "./RowBadges";
import { isSameLabPair, isMergeableAdjacent } from "./labMerge";
import type { FilterableSession } from "./types";

const DAY_ORDER = ["Sat", "Sun", "Mon", "Tues", "Wed"];

const DAY_COL_WIDTH = 56;
const YEAR_COL_WIDTH = 168;
const BREAK_COL_WIDTH = 28;
const SLOT_COL_WIDTH = 132;

type SlotColumn<T> = { sortOrder: number; label: string; timeSlot: T };
type Cell<T> = { session: T; span: 1 | 2; pair?: T } | { session: T; span: 0 } | null;

export type AddSessionContext<T extends FilterableSession> = {
  day: string;
  batch: T["batch"];
  section: string | null;
  // Present when the click came from one specific empty grid cell (that
  // column's slot); absent from the rail's per-group "Add class" button,
  // which isn't tied to any one slot — the admin picks it in the dialog.
  timeSlot?: T["timeSlot"];
};

// Step 41: the Sec 2 (+ its lab pair, if any) that a Sec 1 (or Sec 1's lab
// pair) session can be merged with — keyed by the Sec 1 session's id. Built
// by the caller (which has entity ids to compare with `canCombine`) and
// handed to the grid purely as data, so the grid itself stays agnostic of
// how eligibility is computed.
export type CombineTarget<T> = { partner: T; partnerPair?: T };

function buildCells<T extends FilterableSession>(sessions: T[], slots: SlotColumn<T["timeSlot"]>[]): Cell<T>[] {
  const cells: Cell<T>[] = new Array(slots.length).fill(null);
  for (const s of sessions) {
    const idx = slots.findIndex((c) => c.sortOrder === s.timeSlot.sortOrder);
    if (idx !== -1 && !cells[idx]) cells[idx] = { session: s, span: 1 };
  }
  for (let i = 0; i < slots.length - 1; i++) {
    const a = cells[i];
    const b = cells[i + 1];
    if (!a || !b || a.span !== 1 || b.span !== 1) continue;
    if (!isMergeableAdjacent(slots[i].sortOrder, slots[i + 1].sortOrder)) continue;
    if (isSameLabPair(a.session, b.session)) {
      cells[i] = { session: a.session, span: 2, pair: b.session };
      cells[i + 1] = { session: a.session, span: 0 };
    }
  }
  return cells;
}

// One physical table row: a batch's Sec 1 row, its Sec 2 row, or the single
// row for a batch with no sections (or the Step 39 fallback — see below).
type SectionRow<T> = { section: string | null; sessions: T[] };

// A day+batch's classes, before deciding how many physical rows they need.
// "Both"-section sessions (Step 39: one class taught to both sections at
// once) never define a row of their own — they're layered across whichever
// Sec 1/Sec 2 rows exist, spanning both when there are two.
type BatchDayGroup<T> = {
  day: string;
  batch: T extends FilterableSession ? T["batch"] : never;
  sortKey: number;
  sectionRows: SectionRow<T>[]; // 1 or 2 entries
  bothSessions: T[];
};

// Per-cell render instruction after laying a group's own-section sessions AND
// its "Both" sessions onto the same day×slot grid — colSpan from the lab
// merge above composes with rowSpan from Both spanning two section rows.
type CellDesc<T> =
  | { kind: "empty" }
  | { kind: "skip" }
  | { kind: "session"; session: T; colSpan: 1 | 2; rowSpan: 1 | 2; pair?: T; isBoth: boolean };

function buildGroupGrid<T extends FilterableSession>(
  group: BatchDayGroup<T>,
  slots: SlotColumn<T["timeSlot"]>[]
): CellDesc<T>[][] {
  const numRows = group.sectionRows.length;
  const grid: CellDesc<T>[][] = Array.from({ length: numRows }, () =>
    Array.from({ length: slots.length }, () => ({ kind: "empty" }) as CellDesc<T>)
  );

  function place(sessionList: T[], rowIdx: number, isBoth: boolean, rowSpan: 1 | 2) {
    const cells = buildCells(sessionList, slots);
    for (let col = 0; col < slots.length; col++) {
      const cell = cells[col];
      if (!cell || cell.span === 0) continue;
      grid[rowIdx][col] = { kind: "session", session: cell.session, colSpan: cell.span, rowSpan, pair: cell.span === 2 ? cell.pair : undefined, isBoth };
      if (cell.span === 2) grid[rowIdx][col + 1] = { kind: "skip" };
      if (rowSpan === 2 && rowIdx + 1 < numRows) {
        grid[rowIdx + 1][col] = { kind: "skip" };
        if (cell.span === 2) grid[rowIdx + 1][col + 1] = { kind: "skip" };
      }
    }
  }

  group.sectionRows.forEach((sr, i) => place(sr.sessions, i, false, 1));
  if (group.bothSessions.length > 0) {
    place(group.bothSessions, 0, true, numRows === 2 ? 2 : 1);
  }

  return grid;
}

function GridCell<T extends FilterableSession>({
  desc, band, day, batch, section, column, editable, onEditSession, onDeleteSession, onAddSession,
  combine, onCombine, combining,
}: {
  desc: CellDesc<T>;
  band: Band;
  day: string;
  batch: T["batch"];
  section: string | null;
  column: SlotColumn<T["timeSlot"]>;
  editable: boolean;
  onEditSession?: (session: T, pair?: T) => void;
  onDeleteSession?: (session: T, pair?: T) => void;
  onAddSession?: (ctx: AddSessionContext<T>) => void;
  combine?: CombineTarget<T>;
  onCombine?: (anchor: T, anchorPair: T | undefined, partner: T, partnerPair: T | undefined) => void;
  combining?: boolean;
}) {
  if (desc.kind === "empty") {
    return (
      <td
        className="grid-empty-cell group/cell relative border border-border p-0"
        style={{ width: SLOT_COL_WIDTH, backgroundColor: bandTint(band, 6) }}
      >
        {editable && onAddSession && (
          <button
            type="button"
            onClick={() => onAddSession({ day, batch, section, timeSlot: column.timeSlot })}
            className="print:hidden absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100 text-muted-foreground hover:text-primary transition-opacity"
            aria-label="Add class"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        )}
      </td>
    );
  }

  if (desc.kind === "skip") return null; // never rendered — filtered out by the caller before reaching here

  const { session: s, colSpan, rowSpan, pair, isBoth } = desc;
  const cancelled = s.status === "CANCELLED";
  const moved = !cancelled && Boolean(s.movedTo);
  const fill = cancelled ? "var(--bar-cancelled)" : moved ? "var(--bar-moved)" : bandVar(band);
  const title = courseTitleIfDifferent(s.course);

  return (
    <td
      colSpan={colSpan}
      rowSpan={rowSpan}
      className="h-px border border-border p-1 align-top"
      style={{ width: SLOT_COL_WIDTH * colSpan }}
    >
      <div className="relative group/cell h-full">
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
            <span className="flex items-center gap-1 flex-wrap">
              <span className={`font-data font-semibold text-[11px] leading-tight tabular truncate text-white ${cancelled ? "line-through" : ""}`}>
                {s.course.code}
              </span>
              {pair && (
                <span className="shrink-0 text-[8px] font-bold uppercase tracking-wide text-white/90 bg-white/20 rounded px-1 leading-tight">
                  Lab
                </span>
              )}
              {isBoth && (
                <span className="shrink-0 text-[8px] font-bold uppercase tracking-wide text-white/90 bg-white/20 rounded px-1 leading-tight">
                  Sec 1 &amp; 2
                </span>
              )}
            </span>
            <span className="text-[10px] leading-tight tabular text-white/85 truncate">
              {s.teacher.initials} · R{s.room.name}
            </span>
            {cancelled && <span className="text-[9px] font-bold uppercase tracking-wide text-white/90 truncate">Cancelled</span>}
            {moved && <span className="text-[9px] font-bold uppercase tracking-wide text-white/90 truncate">Moved</span>}
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-semibold">{s.teacher.name}</p>
            <p>{s.course.code}{title ? ` — ${title}` : ""}{pair ? " (2 periods)" : ""}{isBoth ? " · Sec 1 & 2" : ""}</p>
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

        {editable && combine && onCombine && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCombine(s, pair, combine.partner, combine.partnerPair); }}
            disabled={combining}
            className="print:hidden absolute top-1 left-1 z-10 p-1 rounded bg-white/25 hover:bg-white/40 text-white disabled:opacity-50"
            aria-label={`Combine ${s.course.code} into one class for both sections`}
            title="Combine both sections"
          >
            <Combine className="size-3" aria-hidden="true" />
          </button>
        )}

        {editable && (
          <div className="print:hidden absolute top-1 right-1 z-10 flex items-center gap-1 opacity-0 group-hover/cell:opacity-100 focus-within:opacity-100 transition-opacity">
            {onEditSession && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEditSession(s, pair); }}
                className="p-1 rounded bg-white/25 hover:bg-white/40 text-white"
                aria-label={`Edit ${s.course.code}`}
              >
                <Pencil className="size-3" aria-hidden="true" />
              </button>
            )}
            {onDeleteSession && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeleteSession(s, pair); }}
                className="p-1 rounded bg-white/25 hover:bg-white/40 text-white"
                aria-label={`Delete ${s.course.code}`}
              >
                <Trash2 className="size-3" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
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
  sessions, onClearFilters, loading = false, editable = false, onEditSession, onDeleteSession, onAddSession,
  combinablePairs, onCombine, combiningId,
}: {
  sessions: T[];
  onClearFilters?: () => void;
  loading?: boolean;
  editable?: boolean;
  onEditSession?: (session: T, pair?: T) => void;
  onDeleteSession?: (session: T, pair?: T) => void;
  onAddSession?: (ctx: AddSessionContext<T>) => void;
  // Step 41 — combine a Sec 1 + Sec 2 pair into one "Both" class. Keyed by
  // the Sec 1 session's id; see CombineTarget for why the grid doesn't
  // compute eligibility itself.
  combinablePairs?: Map<number, CombineTarget<T>>;
  onCombine?: (anchor: T, anchorPair: T | undefined, partner: T, partnerPair: T | undefined) => void;
  combiningId?: number | null;
}) {
  const slotColumns = useMemo<SlotColumn<T["timeSlot"]>[]>(() => {
    const map = new Map<number, SlotColumn<T["timeSlot"]>>();
    for (const s of sessions) {
      if (!map.has(s.timeSlot.sortOrder)) {
        map.set(s.timeSlot.sortOrder, { sortOrder: s.timeSlot.sortOrder, label: s.timeSlot.label, timeSlot: s.timeSlot });
      }
    }
    return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [sessions]);

  const breakAfterIndex = useMemo(() => {
    for (let i = 0; i < slotColumns.length - 1; i++) {
      if (slotColumns[i].sortOrder === 4 && slotColumns[i + 1].sortOrder === 5) return i;
    }
    return slotColumns.length >= 5 ? 3 : -1;
  }, [slotColumns]);

  // Group by day+batch (no section) — sections are resolved into 1-2 rows below.
  const groups = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const s of sessions) {
      const key = `${s.day}|${s.batch.name}|${s.batch.semester}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    const out: BatchDayGroup<T>[] = [];
    for (const sess of map.values()) {
      const day = sess[0].day;
      const batch = sess[0].batch as BatchDayGroup<T>["batch"];
      const bothSessions = sess.filter((s) => s.section === "Both");
      const nonBoth = sess.filter((s) => s.section !== "Both");
      const distinctSections = [...new Set(nonBoth.map((s) => s.section))];
      let sectionRows: SectionRow<T>[];
      if (distinctSections.length > 0) {
        const sorted = distinctSections.sort((a, b) => (a ?? "").localeCompare(b ?? ""));
        sectionRows = sorted.map((sec) => ({ section: sec, sessions: nonBoth.filter((s) => s.section === sec) }));
      } else {
        // No Sec 1/Sec 2/null rows this day — fall back to one row so a
        // Both-only day still renders (labelled "Sec 1 & 2" via the pill).
        sectionRows = [{ section: bothSessions.length > 0 ? "Both" : null, sessions: [] }];
      }
      const n = parseInt(batch.semester.match(/\d+/)?.[0] ?? "0", 10);
      out.push({ day, batch, sortKey: n, sectionRows, bothSessions });
    }
    return out.sort(
      (a, b) =>
        DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) ||
        b.sortKey - a.sortKey ||
        a.batch.name.localeCompare(b.batch.name)
    );
  }, [sessions]);

  // Flatten into physical rows, each carrying its own pre-built cell row —
  // a Both cell's rowSpan is already resolved here, before rendering.
  const physicalRows = useMemo(() => {
    const out: { day: string; batch: T["batch"]; section: string | null; cells: CellDesc<T>[] }[] = [];
    for (const g of groups) {
      const grid = buildGroupGrid(g, slotColumns);
      g.sectionRows.forEach((sr, i) => {
        out.push({ day: g.day, batch: g.batch as T["batch"], section: sr.section, cells: grid[i] });
      });
    }
    return out;
  }, [groups, slotColumns]);

  const dayRowSpans = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of physicalRows) counts.set(r.day, (counts.get(r.day) ?? 0) + 1);
    return counts;
  }, [physicalRows]);

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
              {physicalRows.map((row, rIdx) => {
                const band = bandForBatch(row.batch);
                const showDay = row.day !== lastDay;
                if (showDay) lastDay = row.day;
                const daySpan = dayRowSpans.get(row.day) ?? 1;

                return (
                  <tr
                    key={`${row.day}-${row.batch.name}-${row.batch.semester}-${row.section ?? ""}-${rIdx}`}
                    className="break-inside-avoid"
                  >
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
                              rowSpan={physicalRows.length}
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
                        const desc = row.cells[i];
                        if (desc.kind === "skip") continue;
                        const combine = desc.kind === "session" ? combinablePairs?.get(desc.session.id) : undefined;
                        out.push(
                          <GridCell
                            key={slotColumns[i].sortOrder}
                            desc={desc}
                            band={band}
                            day={row.day}
                            batch={row.batch}
                            section={row.section}
                            column={slotColumns[i]}
                            editable={editable}
                            onEditSession={onEditSession}
                            onDeleteSession={onDeleteSession}
                            onAddSession={onAddSession}
                            combine={combine}
                            onCombine={onCombine}
                            combining={desc.kind === "session" && combiningId === desc.session.id}
                          />
                        );
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
