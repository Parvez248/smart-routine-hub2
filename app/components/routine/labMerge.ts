import type { FilterableSession } from "./types";

// A lab class covers two consecutive periods, stored as two ordinary Session
// rows (the schema has one timeSlotId per row — see lib/services/scheduling).
// This is the one place that decides whether two rows are "the same lab" so
// the grid, the rail, and the admin dialog never disagree with each other.

export function isSameLabPair<T extends FilterableSession>(a: T, b: T): boolean {
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

/** True when two sortOrders are adjacent and don't straddle the break (4→5). */
export function isMergeableAdjacent(sortOrderA: number, sortOrderB: number): boolean {
  if (sortOrderB !== sortOrderA + 1) return false;
  return !(sortOrderA === 4 && sortOrderB === 5);
}

/** The two periods a lab starting at `startSortOrder` would occupy. */
export function labPair(startSortOrder: number): [number, number] {
  return [startSortOrder, startSortOrder + 1];
}

/**
 * A lab may start at any slot whose next slot exists and doesn't cross the
 * break — i.e. every slot except the one right before the break (4) and the
 * very last slot (no next slot to pair with). `allSortOrders` is the full set
 * of slots actually in use, so a start is only offered when its pair partner
 * really exists (Step 38 — previously this was wrongly hard-coded to 1/3/5).
 */
export function isValidLabStart(startSortOrder: number, allSortOrders: number[]): boolean {
  const [, next] = labPair(startSortOrder);
  if (!allSortOrders.includes(next)) return false;
  return isMergeableAdjacent(startSortOrder, next);
}

export type MergedEntry<T> = { session: T; span: 1 | 2; pair?: T };

/**
 * Collapses a same-day/batch/section session list (any order) into display
 * entries — a matched two-period lab becomes one span-2 entry carrying both
 * sessions; everything else stays span-1. Used by both the rail (flat list)
 * and, in spirit, the grid (which additionally needs column positions and
 * reimplements the same predicates against its own column index).
 */
export function mergeLabPairs<T extends FilterableSession>(sessions: T[]): MergedEntry<T>[] {
  const sorted = [...sessions].sort((a, b) => a.timeSlot.sortOrder - b.timeSlot.sortOrder);
  const out: MergedEntry<T>[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    if (
      next &&
      isMergeableAdjacent(cur.timeSlot.sortOrder, next.timeSlot.sortOrder) &&
      isSameLabPair(cur, next)
    ) {
      out.push({ session: cur, span: 2, pair: next });
      i++;
    } else {
      out.push({ session: cur, span: 1 });
    }
  }
  return out;
}

/** "11:30 – 12:30 pm" + "12:30 – 01:30 pm" → "11:30 – 01:30 pm". */
export function combineSlotLabels(firstLabel: string, secondLabel: string): string {
  const start = firstLabel.split("–")[0]?.trim() ?? firstLabel;
  const end = secondLabel.split("–")[1]?.trim() ?? secondLabel;
  return `${start} – ${end}`;
}
