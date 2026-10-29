import { isMergeableAdjacent } from "@/lib/ui/periods";
import type { FilterableSession } from "./types";

// A lab class covers two consecutive periods, stored as two ordinary Session
// rows (the schema has one timeSlotId per row — see lib/services/scheduling).
// This is the one place that decides whether two rows are "the same lab" so
// the grid, the rail, and the admin dialog never disagree with each other.
//
// Step 52 moved the *structural* half of these rules — which periods are
// adjacent, which ones a lab may start at — into lib/ui/periods.ts, because
// they depend on the routine version's own period set (where its break
// falls). What is left here is the "are these two rows the same class?"
// question, which is version-independent.

/**
 * True when `a` and `b` are the two rows of one lab class — same LAB
 * course, teacher, room, status, and (if either was rescheduled) the same
 * override destination. Does not check that the time slots are adjacent;
 * callers combine this with isMergeableAdjacent for that.
 */
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

/** The two periods a lab starting at `startSortOrder` would occupy. */
export function labPair(startSortOrder: number): [number, number] {
  return [startSortOrder, startSortOrder + 1];
}

// One display entry after merging: span 1 is a normal class, span 2 is a
// matched lab pair (`pair` holds its second-period session).
export type MergedEntry<T> = { session: T; span: 1 | 2; pair?: T };

/**
 * Collapses a same-day/batch/section session list (any order) into display
 * entries — a matched two-period lab becomes one span-2 entry carrying both
 * sessions; everything else stays span-1. Used by both the rail (flat list)
 * and, in spirit, the grid (which additionally needs column positions and
 * reimplements the same predicates against its own column index).
 *
 * `breakAfter` is the sortOrder the break follows in *this routine
 * version's* period set (Step 52) — null when it has no break. Two periods
 * either side of the break are never one lab, and where that break falls
 * differs per version, so it has to be passed in rather than assumed.
 */
export function mergeLabPairs<T extends FilterableSession>(
  sessions: T[],
  breakAfter: number | null
): MergedEntry<T>[] {
  const sorted = [...sessions].sort((a, b) => a.timeSlot.sortOrder - b.timeSlot.sortOrder);
  const out: MergedEntry<T>[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    if (
      next &&
      isMergeableAdjacent(cur.timeSlot.sortOrder, next.timeSlot.sortOrder, breakAfter) &&
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
