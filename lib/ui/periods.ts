/**
 * Everything the app needs to reason about a routine version's day
 * structure, with no database access — so client components (the grid, the
 * rail, the session dialog, the periods editor) can import it directly.
 * The db-backed half ("which periods does version N use?") lives in
 * lib/services/periods.ts.
 *
 * Before Step 52 these rules were hard-coded: the break was always after
 * period 4 and a lab could start at 1, 2, 3 or 5. Fall 2026 has five
 * longer periods with the break after period 3 and lab starts 1, 2, 4, so
 * the rules now read the period set instead of assuming one.
 */

/** A period column, as the API returns it (a TimeSlot row's display fields). */
export type Period = {
  id: number;
  label: string;
  sortOrder: number;
  startTime: string | null;
  endTime: string | null;
  breakAfter: boolean;
};

/** A special block (e.g. Club Activities) with its batches resolved. */
export type SpecialBlockView = {
  id: number;
  day: string;
  fromSlot: number;
  toSlot: number;
  label: string;
  subLabel: string | null;
  allBatches: boolean;
  batchIds: number[];
  /**
   * The batch records behind `batchIds` (empty for an all-batches block).
   *
   * The grid needs them, not just the ids: a batch named by a block often
   * has *no classes at all* that day — Fall 2026's 24th and 26th do Club
   * Activities on Wednesday afternoon and nothing else that day — so there
   * is no session to build its row from, and without a row the block it
   * was created for would never be drawn.
   */
  batches: { id: number; name: string; semester: string; sectionCount: number }[];
};

/** Periods in schedule order. Every helper here assumes this order. */
export function sortPeriods<T extends { sortOrder: number }>(periods: T[]): T[] {
  return [...periods].sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * The `sortOrder` of the period the break follows, or null when the set has
 * no break. Only the first flagged period counts — the API allows at most
 * one, and a second one in legacy data must not silently move the divider.
 */
export function breakAfterSortOrder(periods: Period[]): number | null {
  const flagged = sortPeriods(periods).find((p) => p.breakAfter);
  return flagged?.sortOrder ?? null;
}

/**
 * True when a two-period lab may run from `sortOrderA` into `sortOrderB` —
 * they must be consecutive and must not straddle the break.
 *
 * `breakAfter` is the break's position (breakAfterSortOrder above) and is
 * deliberately a required argument: when it was an implicit "4" inside this
 * function, every caller silently inherited Spring 2026's structure. Making
 * it explicit turns a missed call site into a type error.
 */
export function isMergeableAdjacent(
  sortOrderA: number,
  sortOrderB: number,
  breakAfter: number | null
): boolean {
  if (sortOrderB !== sortOrderA + 1) return false;
  return sortOrderA !== breakAfter;
}

/**
 * Every period a two-period lab may start at: one whose next period exists
 * in this set and which the break doesn't follow.
 *   standard set (6 periods, break after 4) -> [1, 2, 3, 5]
 *   Fall 2026    (5 periods, break after 3) -> [1, 2, 4]
 */
export function validLabStarts(periods: Period[]): number[] {
  const sorted = sortPeriods(periods);
  const present = new Set(sorted.map((p) => p.sortOrder));
  const breakAfter = breakAfterSortOrder(periods);
  return sorted
    .filter((p) => present.has(p.sortOrder + 1) && isMergeableAdjacent(p.sortOrder, p.sortOrder + 1, breakAfter))
    .map((p) => p.sortOrder);
}

/** True when a lab may start at this period of this set. */
export function isValidLabStart(sortOrder: number, periods: Period[]): boolean {
  return validLabStarts(periods).includes(sortOrder);
}

/** The two periods a lab starting here would occupy, or null if it can't. */
export function labPairIn(periods: Period[], startSortOrder: number): [Period, Period] | null {
  if (!isValidLabStart(startSortOrder, periods)) return null;
  const first = periods.find((p) => p.sortOrder === startSortOrder);
  const second = periods.find((p) => p.sortOrder === startSortOrder + 1);
  return first && second ? [first, second] : null;
}

/** The periods that come after the break — where a special block can sit. */
export function postBreakPeriods(periods: Period[]): Period[] {
  const breakAfter = breakAfterSortOrder(periods);
  if (breakAfter === null) return [];
  return sortPeriods(periods).filter((p) => p.sortOrder > breakAfter);
}

/** "5 periods · break after 3 · lab starts 1, 2, 4" — the editor's preview line. */
export function periodSummary(periods: Period[]): string {
  if (periods.length === 0) return "No periods";
  const breakAfter = breakAfterSortOrder(periods);
  const starts = validLabStarts(periods);
  const parts = [`${periods.length} ${periods.length === 1 ? "period" : "periods"}`];
  parts.push(breakAfter === null ? "no break" : `break after ${breakAfter}`);
  parts.push(starts.length === 0 ? "no lab starts" : `lab starts ${starts.join(", ")}`);
  return parts.join(" · ");
}

/**
 * Does this block cover this batch's rows? `allBatches` blocks cover
 * everything (which is what Spring 2026's backfilled Club Activities
 * block does, matching how it has always been drawn); otherwise only the
 * batches explicitly listed on the block.
 */
export function blockAppliesTo(block: SpecialBlockView, batchId: number): boolean {
  return block.allBatches || block.batchIds.includes(batchId);
}

/** The blocks of one day, earliest-covering first. */
export function blocksForDay(blocks: SpecialBlockView[], day: string): SpecialBlockView[] {
  return blocks.filter((b) => b.day === day).sort((a, b) => a.fromSlot - b.fromSlot);
}

/**
 * Validates a whole period set the way PUT .../periods does, so the editor
 * can show the same errors before saving. Returns [] when the set is valid.
 */
export function periodSetErrors(
  periods: { label: string; sortOrder: number; startTime: string | null; endTime: string | null; breakAfter: boolean }[]
): string[] {
  const errors: string[] = [];
  if (periods.length === 0) return ["Add at least one period."];

  const sorted = [...periods].sort((a, b) => a.sortOrder - b.sortOrder);

  const orders = sorted.map((p) => p.sortOrder);
  if (new Set(orders).size !== orders.length) errors.push("Two periods have the same number.");

  if (sorted.filter((p) => p.breakAfter).length > 1) errors.push("Only one period can have a break after it.");

  let previousEnd: number | null = null;
  for (const p of sorted) {
    if (!p.label.trim()) {
      errors.push(`Period ${p.sortOrder} has no label.`);
      continue;
    }
    const start = p.startTime ? minutesOf(p.startTime) : null;
    const end = p.endTime ? minutesOf(p.endTime) : null;
    if ((p.startTime && start === null) || (p.endTime && end === null)) {
      errors.push(`Period ${p.sortOrder} has an invalid time (use HH:MM).`);
      continue;
    }
    if (start !== null && end !== null && start >= end) {
      errors.push(`Period ${p.sortOrder} ends before it starts.`);
      continue;
    }
    if (previousEnd !== null && start !== null && start < previousEnd) {
      errors.push(`Period ${p.sortOrder} starts before the period before it ends.`);
    }
    if (end !== null) previousEnd = end;
  }

  return errors;
}

/** "14:30" -> 870; null when it isn't a valid 24-hour "HH:MM". */
export function minutesOf(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}
