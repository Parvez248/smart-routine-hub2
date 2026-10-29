"use client";

/**
 * The desktop Full Routine grid — a real HTML `<table>`, one column per
 * time slot, one or two rows per batch per day. Shared by all three roles
 * (admin/teacher/student both fetch different data and pass it into the
 * same component); the `editable` prop is what turns on admin-only affordances
 * (the "+" add button on empty cells, hover edit/delete/combine controls) —
 * teacher and student always render with `editable` unset, so they get the
 * exact same layout, read-only.
 *
 * Three kinds of "span" compose in the same cell, and get harder to reason
 * about together, so here's the model:
 *  - a two-period LAB is one class occupying two adjacent time-slot
 *    *columns* → `colSpan={2}` (see buildCells/isSameLabPair in labMerge.ts);
 *  - a `"Both"`-section class is one class occupying both the Sec 1 and
 *    Sec 2 *rows* of its batch at that slot → `rowSpan={2}` (see
 *    buildGroupGrid below and sectionsCoveredBy in lib/ui/sections.ts);
 *  - a lab that is also Both does both at once → a single cell with
 *    colSpan={2} AND rowSpan={2}, a 2×2 block.
 * Whichever cells a span covers, the *other* cells it would otherwise
 * occupy must not also render a `<td>` — HTML tables render the next cell
 * immediately adjacent to a spanning one, so an extra `<td>` there would
 * visually shift every following column/row. Cells covered by a span are
 * marked `{ kind: "skip" }` and the render loop below (`if (desc.kind ===
 * "skip") continue`) simply emits nothing for them — this "skip"
 * bookkeeping is the single most important invariant in this file.
 *
 * A day's post-break columns can also be entirely replaced by one
 * full-width band (e.g. Wednesday's "Club Activities" — Step 46) using the
 * exact same span+skip mechanism, driven by the routine version's special
 * blocks rather than by session data.
 *
 * Step 52 — the columns themselves, and where the BREAK divider goes, come
 * from the version's own period set (the `periods` prop), not from whichever
 * slots happen to appear in `sessions`. That is what lets a routine with
 * five 1h15 periods and the break after period 3 render beside one with six
 * 1-hour periods and the break after period 4, and what makes a brand-new
 * version show its columns before it has a single class in it.
 */
import { Fragment, useMemo } from "react";
import { Pencil, Trash2, Plus, Combine } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { bandForBatch, bandTint, bandVar, type Band } from "@/lib/ui/bandColors";
import { BatchPill, courseTitleIfDifferent, formatMovedDate } from "./RowBadges";
import { isSameLabPair } from "./labMerge";
import {
  blockAppliesTo,
  blocksForDay,
  breakAfterSortOrder,
  isMergeableAdjacent,
  sortPeriods,
  type Period,
  type SpecialBlockView,
} from "@/lib/ui/periods";
import type { FilterableSession } from "./types";

const DAY_ORDER = ["Sat", "Sun", "Mon", "Tues", "Wed"];

const DAY_COL_WIDTH = 56;
const YEAR_COL_WIDTH = 168;
const BREAK_COL_WIDTH = 28;
const SLOT_COL_WIDTH = 132;

// A column is a period of the version's set. Before Step 52 it was
// reconstructed from a session's own timeSlot, which is why an empty
// version had no columns at all.
type SlotColumn = Period;
type Cell<T> = { session: T; span: 1 | 2; pair?: T } | { session: T; span: 0 } | null;

export type AddSessionContext<T extends FilterableSession> = {
  day: string;
  batch: T["batch"];
  section: string | null;
  // Present when the click came from one specific empty grid cell (that
  // column's slot); absent from the rail's per-group "Add class" button,
  // which isn't tied to any one slot — the admin picks it in the dialog.
  timeSlot?: Period;
};

// Step 41: the Sec 2 (+ its lab pair, if any) that a Sec 1 (or Sec 1's lab
// pair) session can be merged with — keyed by the Sec 1 session's id. Built
// by the caller (which has entity ids to compare with `canCombine`) and
// handed to the grid purely as data, so the grid itself stays agnostic of
// how eligibility is computed.
export type CombineTarget<T> = { partner: T; partnerPair?: T };

// Lays out one section row's sessions across the slot columns, merging a
// matched lab pair into a single span-2 cell. First pass places each
// session at its own time slot; second pass scans adjacent pairs and
// collapses them where isSameLabPair + isMergeableAdjacent agree they're
// one lab (the second slot becomes `span: 0`, meaning "already covered").
function buildCells<T extends FilterableSession>(
  sessions: T[],
  slots: SlotColumn[],
  breakAfter: number | null
): Cell<T>[] {
  const cells: Cell<T>[] = new Array(slots.length).fill(null);
  for (const s of sessions) {
    const idx = slots.findIndex((c) => c.sortOrder === s.timeSlot.sortOrder);
    if (idx !== -1 && !cells[idx]) cells[idx] = { session: s, span: 1 };
  }
  for (let i = 0; i < slots.length - 1; i++) {
    const a = cells[i];
    const b = cells[i + 1];
    if (!a || !b || a.span !== 1 || b.span !== 1) continue;
    if (!isMergeableAdjacent(slots[i].sortOrder, slots[i + 1].sortOrder, breakAfter)) continue;
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

// Builds the 1-or-2-row × slot-count grid of CellDesc for one batch on one
// day: each section row's own sessions are placed first (via buildCells,
// so lab colSpan is already resolved), then any "Both" sessions are placed
// on top starting at row 0 with rowSpan 2 (or 1 if there's only one section
// row to span into) — `place()` marks whatever that covers in the row(s)
// below as "skip" so the render loop never double-emits a cell there.
function buildGroupGrid<T extends FilterableSession>(
  group: BatchDayGroup<T>,
  slots: SlotColumn[],
  breakAfter: number | null
): CellDesc<T>[][] {
  const numRows = group.sectionRows.length;
  const grid: CellDesc<T>[][] = Array.from({ length: numRows }, () =>
    Array.from({ length: slots.length }, () => ({ kind: "empty" }) as CellDesc<T>)
  );

  function place(sessionList: T[], rowIdx: number, isBoth: boolean, rowSpan: 1 | 2) {
    const cells = buildCells(sessionList, slots, breakAfter);
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
  column: SlotColumn;
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
            onClick={() => onAddSession({ day, batch, section, timeSlot: column })}
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
    // `h-px` (height: 1px) looks wrong but is deliberate: a <td>'s height is
    // "auto" by default, and CSS ignores percentage heights (like the child
    // `h-full` below) inside an auto-height container. Giving the cell any
    // *definite* height — even 1px — makes the browser resolve `h-full`
    // against the cell's real rendered height instead, which is what
    // actually makes the band colour fill the whole rowSpan (not just one
    // row's worth) for a "Both" cell. Table layout still sizes the row by
    // content as normal; this only unlocks the percentage-height chain.
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
  combinablePairs, onCombine, combiningId, periods, specialBlocks = [], showEmptyGrid = false,
}: {
  sessions: T[];
  onClearFilters?: () => void;
  loading?: boolean;
  editable?: boolean;
  onEditSession?: (session: T, pair?: T) => void;
  onDeleteSession?: (session: T, pair?: T) => void;
  onAddSession?: (ctx: AddSessionContext<T>) => void;
  // Step 52 — this routine version's period set (GET /api/periods). The
  // columns, their labels and the BREAK divider all come from it. Omitted
  // (or empty) falls back to reconstructing the columns from `sessions`,
  // which is what every view did before this step.
  periods?: Period[];
  // The version's display-only bands (Club Activities). Each is drawn only
  // across the rows of the batches it applies to.
  specialBlocks?: SpecialBlockView[];
  // Draw the period columns with empty, addable cells when there are no
  // sessions at all, instead of the "no classes match" empty state. The
  // admin builder passes this for a version that has no classes yet — it
  // is how a new routine gets its first class. A view whose list is empty
  // because of *filters* must not pass it, or the filter feedback is lost.
  showEmptyGrid?: boolean;
  // Step 41 — combine a Sec 1 + Sec 2 pair into one "Both" class. Keyed by
  // the Sec 1 session's id; see CombineTarget for why the grid doesn't
  // compute eligibility itself.
  combinablePairs?: Map<number, CombineTarget<T>>;
  onCombine?: (anchor: T, anchorPair: T | undefined, partner: T, partnerPair: T | undefined) => void;
  combiningId?: number | null;
}) {
  // The columns: this version's periods when they were passed in, else
  // reconstructed from the sessions in view (pre-Step-52 behaviour, kept so
  // a caller that doesn't yet fetch periods still renders).
  const slotColumns = useMemo<SlotColumn[]>(() => {
    if (periods && periods.length > 0) return sortPeriods(periods);
    const map = new Map<number, SlotColumn>();
    for (const s of sessions) {
      if (!map.has(s.timeSlot.sortOrder)) {
        map.set(s.timeSlot.sortOrder, {
          id: -s.timeSlot.sortOrder,
          sortOrder: s.timeSlot.sortOrder,
          label: s.timeSlot.label,
          startTime: null,
          endTime: null,
          // Without a period set there is nothing to read the break from,
          // so fall back to Spring 2026's structure (after period 4), which
          // is what this was hard-coded to before Step 52.
          breakAfter: s.timeSlot.sortOrder === 4,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [periods, sessions]);

  // The sortOrder the break follows, straight from the period set.
  const breakAfter = useMemo(() => breakAfterSortOrder(slotColumns), [slotColumns]);

  // The column index right before the break/prayer gap — everything after
  // it gets a narrow visual divider column, and (Step 46) is where a day's
  // special block starts. -1 when this set has no break, or when the break
  // falls after its last visible column (nothing to divide).
  const breakAfterIndex = useMemo(() => {
    if (breakAfter === null) return -1;
    const idx = slotColumns.findIndex((c) => c.sortOrder === breakAfter);
    return idx === slotColumns.length - 1 ? -1 : idx;
  }, [slotColumns, breakAfter]);

  // Which column position the BREAK divider is inserted *before* — a
  // separate index because the divider is an extra column of its own, not
  // one of the periods. -1 means this set draws no divider at all, and is
  // kept separate from `breakAfterIndex + 1` so that case can't be
  // confused with "before the first column".
  const breakColumnIndex = breakAfterIndex >= 0 ? breakAfterIndex + 1 : -1;

  // A sectioned batch (Step 45) always draws both its Sec 1 and Sec 2 rows
  // on every day it appears, even where one or both are empty — otherwise
  // the row count would vary day to day with whichever section happened to
  // have a class.
  //
  // Step 50 — "sectioned" now comes from the batch's own `sectionCount`
  // setting rather than being inferred from the loaded sessions. The old
  // inference made a batch look section-less in any version that didn't
  // yet contain its Sec 1/Sec 2 classes, so a brand-new or empty version
  // drew a single row and offered no section options at all.
  // Group by day+batch (no section) — sections are resolved into 1-2 rows below.
  const groups = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const s of sessions) {
      const key = `${s.day}|${s.batch.name}|${s.batch.semester}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }

    // Step 52 — a batch a special block *names* gets a row on that day even
    // with no classes at all, because that row is the only place its block
    // can be drawn. Fall 2026's 24th and 26th are exactly this: Club
    // Activities on Wednesday afternoon and nothing else that day.
    //
    // Only batch-scoped blocks do this. An all-batches block says nothing
    // about which batches exist, so it keeps using whichever rows the day
    // already has — which is how Spring 2026's Wednesday band has always
    // been drawn, and what keeps it unchanged.
    const extraRowBatches = new Map<string, BatchDayGroup<T>["batch"]>();
    for (const block of specialBlocks) {
      if (block.allBatches) continue;
      for (const batch of block.batches) {
        const key = `${block.day}|${batch.name}|${batch.semester}`;
        if (!map.has(key) && !extraRowBatches.has(key)) {
          extraRowBatches.set(key, batch as BatchDayGroup<T>["batch"]);
        }
      }
    }

    const out: BatchDayGroup<T>[] = [];
    for (const [key, batch] of extraRowBatches) {
      const day = key.split("|")[0];
      const n = parseInt(batch.semester.match(/\d+/)?.[0] ?? "0", 10);
      const sectionRows: SectionRow<T>[] =
        batch.sectionCount === 2
          ? [{ section: "Sec 1", sessions: [] }, { section: "Sec 2", sessions: [] }]
          : [{ section: null, sessions: [] }];
      out.push({ day, batch, sortKey: n, sectionRows, bothSessions: [] });
    }

    for (const sess of map.values()) {
      const day = sess[0].day;
      const batch = sess[0].batch as BatchDayGroup<T>["batch"];
      const bothSessions = sess.filter((s) => s.section === "Both");
      const nonBoth = sess.filter((s) => s.section !== "Both");
      let sectionRows: SectionRow<T>[];
      if (batch.sectionCount === 2) {
        sectionRows = [
          { section: "Sec 1", sessions: nonBoth.filter((s) => s.section === "Sec 1") },
          { section: "Sec 2", sessions: nonBoth.filter((s) => s.section === "Sec 2") },
        ];
        // Defensive: a sectioned batch shouldn't have a session with any
        // other section value, but never silently drop one if it does.
        const other = nonBoth.filter((s) => s.section !== "Sec 1" && s.section !== "Sec 2");
        for (const sec of new Set(other.map((s) => s.section))) {
          sectionRows.push({ section: sec, sessions: other.filter((s) => s.section === sec) });
        }
      } else {
        sectionRows = [{ section: null, sessions: nonBoth }];
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
  }, [sessions, specialBlocks]);

  // Flatten into physical rows, each carrying its own pre-built cell row —
  // a Both cell's rowSpan is already resolved here, before rendering.
  const physicalRows = useMemo(() => {
    const out: { day: string; batch: T["batch"]; section: string | null; cells: CellDesc<T>[] }[] = [];
    for (const g of groups) {
      const grid = buildGroupGrid(g, slotColumns, breakAfter);
      g.sectionRows.forEach((sr, i) => {
        out.push({ day: g.day, batch: g.batch as T["batch"], section: sr.section, cells: grid[i] });
      });
    }
    return out;
  }, [groups, slotColumns, breakAfter]);

  // How many physical rows each day occupies — drives the rowSpan on that
  // day's sticky "Sat"/"Sun"/etc. label cell (only rendered once, on the
  // day's first row).
  const dayRowSpans = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of physicalRows) counts.set(r.day, (counts.get(r.day) ?? 0) + 1);
    return counts;
  }, [physicalRows]);

  /**
   * Where each special block is drawn, resolved down to table coordinates.
   *
   * Step 46 drew one band per *day*, spanning every row — correct while
   * Club Activities applied to every batch. Step 52's blocks can name
   * specific batches (Fall 2026 runs it for the 6th-8th semesters only),
   * so a block now covers a *run of consecutive rows*: the rows of the
   * batches it applies to. When it applies to them all, that run is the
   * whole day and the output is identical to Step 46's — which is what
   * keeps Spring 2026's Wednesday band exactly as it was.
   *
   * A row is left out of the run when it already has something scheduled
   * in the block's columns, so a real class is never hidden behind a band.
   * `starts` holds the band to render at a row (keyed by row index);
   * `covered` holds every row×column the bands occupy, which the render
   * loop skips so no stray <td> shifts the table.
   */
  const bands = useMemo(() => {
    const starts = new Map<string, { block: SpecialBlockView; colSpan: number; rowSpan: number; showLabel: boolean }>();
    const covered = new Set<string>();
    if (specialBlocks.length === 0 || slotColumns.length === 0) return { starts, covered };

    // Rows are grouped by day (physicalRows is built in day order), so each
    // day's rows are one contiguous index range.
    const rowsByDay = new Map<string, number[]>();
    physicalRows.forEach((row, idx) => {
      if (!rowsByDay.has(row.day)) rowsByDay.set(row.day, []);
      rowsByDay.get(row.day)!.push(idx);
    });

    for (const [day, rowIndexes] of rowsByDay) {
      for (const block of blocksForDay(specialBlocks, day)) {
        const cols: number[] = [];
        slotColumns.forEach((col, i) => {
          if (col.sortOrder >= block.fromSlot && col.sortOrder <= block.toSlot) cols.push(i);
        });
        if (cols.length === 0) continue;

        // The BREAK divider is a column of its own, so a block covering
        // periods on both sides of it is drawn as two bands either side
        // rather than one <td> swallowing the divider (which would leave
        // this row one cell short of every other row).
        const segments: number[][] = [];
        let current: number[] = [];
        for (const c of cols) {
          if (current.length > 0 && c === breakColumnIndex) {
            segments.push(current);
            current = [];
          }
          current.push(c);
        }
        if (current.length > 0) segments.push(current);

        const eligible = rowIndexes.filter((idx) => {
          const row = physicalRows[idx];
          if (!blockAppliesTo(block, row.batch.id)) return false;
          // "empty" is the only cell kind a band may replace: a "session"
          // is a real class, and a "skip" is one spanning in from a
          // neighbouring cell.
          return cols.every((c) => row.cells[c]?.kind === "empty");
        });

        // Maximal runs of consecutive rows — one band per run per segment.
        let runStart: number | null = null;
        let runLength = 0;
        const flush = () => {
          if (runStart === null) return;
          segments.forEach((segment, segmentIndex) => {
            starts.set(`${runStart}|${segment[0]}`, {
              block,
              colSpan: segment.length,
              rowSpan: runLength,
              // The label belongs on the first segment only, so a split
              // block doesn't read as two separate activities.
              showLabel: segmentIndex === 0,
            });
          });
          for (let r = runStart; r < runStart + runLength; r++) {
            for (const c of cols) covered.add(`${r}|${c}`);
          }
          runStart = null;
          runLength = 0;
        };
        for (const idx of eligible) {
          if (runStart !== null && idx === runStart + runLength) runLength++;
          else {
            flush();
            runStart = idx;
            runLength = 1;
          }
        }
        flush();
      }
    }

    return { starts, covered };
  }, [specialBlocks, slotColumns, physicalRows, breakColumnIndex]);

  if (loading) return <GridSkeleton />;

  // An empty version still draws its period columns for the admin builder
  // (showEmptyGrid); every other empty list is a filter result and says so.
  if (sessions.length === 0 && !(showEmptyGrid && slotColumns.length > 0)) {
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
                  {i === breakColumnIndex && <col style={{ width: BREAK_COL_WIDTH }} />}
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
                    {i === breakColumnIndex && (
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
              {/* An empty version (showEmptyGrid) has its columns but no
                  batch rows to hang cells on, so there is nothing to click
                  "+" in — say where the first class comes from instead. */}
              {physicalRows.length === 0 && (
                <tr>
                  <td
                    colSpan={2 + slotColumns.length + (breakColumnIndex >= 0 ? 1 : 0)}
                    className="border border-border px-5 py-8 text-center text-sm text-muted-foreground"
                  >
                    This version has no classes yet. Add the first one with the
                    <span className="font-semibold text-foreground"> Add New Session </span>
                    form above.
                  </td>
                </tr>
              )}
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
                        if (i === breakColumnIndex && rIdx === 0) {
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
                        // Step 46/52 — a special block (e.g. Club Activities)
                        // replaces the cells it covers with one band, drawn
                        // once at the top-left of the rows×columns it spans
                        // (see `bands`). Rows and columns it covers but does
                        // not start at render nothing, exactly like a lab's
                        // or a "Both" class's skipped cells.
                        const blockBand = bands.starts.get(`${rIdx}|${i}`);
                        if (blockBand) {
                          out.push(
                            <td
                              key={`band-${blockBand.block.id}-${i}`}
                              colSpan={blockBand.colSpan}
                              rowSpan={blockBand.rowSpan}
                              style={{ width: SLOT_COL_WIDTH * blockBand.colSpan }}
                              className="border border-border print:border-foreground bg-muted/30 text-center align-middle"
                            >
                              {blockBand.showLabel && (
                                <>
                                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground print:text-foreground print:text-sm print:font-bold">
                                    {blockBand.block.label}
                                  </span>
                                  {blockBand.block.subLabel && (
                                    <span className="block text-[10px] text-muted-foreground print:text-foreground">
                                      {blockBand.block.subLabel}
                                    </span>
                                  )}
                                </>
                              )}
                            </td>
                          );
                          continue;
                        }
                        if (bands.covered.has(`${rIdx}|${i}`)) continue;
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
