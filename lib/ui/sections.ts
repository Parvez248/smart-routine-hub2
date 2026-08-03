// A batch's sections: `null` (the batch isn't split), "Sec 1", "Sec 2", or the
// combined "Both" — one class taught to both sections at once (Step 39). This
// is the single source of truth for what a section value "covers", so the
// grid, the rail, the conflict check, and the dialog never disagree.
export type SectionValue = string | null | undefined;

/** The concrete section(s) a session's `section` value actually occupies. */
export function sectionsCoveredBy(section: SectionValue): (string | null)[] {
  const trimmed = section?.trim() || null;
  if (trimmed && /^both$/i.test(trimmed)) return ["Sec 1", "Sec 2"];
  return [trimmed];
}

/** True when two section values occupy any of the same concrete section(s). */
export function sectionsIntersect(a: SectionValue, b: SectionValue): boolean {
  const coveredA = sectionsCoveredBy(a);
  const coveredB = sectionsCoveredBy(b);
  return coveredA.some((x) => coveredB.includes(x));
}

/** Human-readable label — "Sec 1 & 2" for Both, else the plain "Sec N" form
 * (the stored value is already "Sec 2"-shaped; never double-prefix it). */
export function sectionLabel(section: SectionValue): string | null {
  const trimmed = section?.trim() || null;
  if (!trimmed) return null;
  if (/^both$/i.test(trimmed)) return "Sec 1 & 2";
  return /^sec\b/i.test(trimmed) ? trimmed : `Sec ${trimmed}`;
}

// The subset of a session's fields Step 41's Combine action needs to judge
// whether a Sec 1 row and a Sec 2 row are truly the same class — deliberately
// narrower than the routine views' FilterableSession (which drops entity ids
// in favour of display fields), so this stays usable anywhere a session has
// resolved course/teacher/room/timeSlot relations, without widening that
// shared type just for admin-only tooling.
export type CombineCandidate = {
  section: string | null;
  status: string;
  course: { id: number };
  teacher: { id: number };
  room: { id: number };
  timeSlot: { id: number };
  movedTo: unknown | null;
};

/**
 * True when `a` and `b` are one Sec 1 row and one Sec 2 row for the exact
 * same class — same course, teacher, room, and time slot, both active with
 * no reschedule override — and can be safely merged into a single "Both"
 * row (Step 41). Order of the two arguments doesn't matter. Deliberately
 * strict: any difference (room, teacher, slot) means they're genuinely
 * different classes and must not be offered for combining.
 */
export function canCombine(a: CombineCandidate, b: CombineCandidate): boolean {
  const sections = [a.section, b.section].sort();
  if (sections[0] !== "Sec 1" || sections[1] !== "Sec 2") return false;
  if (a.status !== "ACTIVE" || b.status !== "ACTIVE") return false;
  if (a.movedTo || b.movedTo) return false;
  if (a.course.id !== b.course.id) return false;
  if (a.teacher.id !== b.teacher.id) return false;
  if (a.room.id !== b.room.id) return false;
  if (a.timeSlot.id !== b.timeSlot.id) return false;
  return true;
}
