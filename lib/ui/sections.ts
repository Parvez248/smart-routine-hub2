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

/**
 * The section values a batch may use, from its own `sectionCount` setting
 * (Step 50) — the single answer to "does this batch have sections?", replacing
 * the old approach of inferring it from whichever sessions a version happened
 * to contain (which made every batch look section-less in a new/empty version).
 * `[]` means the batch isn't split, so its classes carry `section: null`.
 */
export function sectionOptionsFor(sectionCount: number): string[] {
  return sectionCount === 2 ? ["Sec 1", "Sec 2", "Both"] : [];
}

/** Dropdown label for a section value — "Both" reads as "Both Sections". */
export function sectionOptionLabel(section: string): string {
  return section === "Both" ? "Both Sections" : section;
}

/**
 * Whether `section` is a legal value for a batch with this `sectionCount`:
 * an unsectioned batch (1) must use `null`; a sectioned one (2) must use
 * exactly "Sec 1", "Sec 2" or "Both". Used by the session API to reject
 * anything else with a 400 (Step 50 §7) — which also closes the door on the
 * typos the old free-text section box allowed ("sec1", "Section 1"), since
 * those would silently break sectionsIntersect, the two-row span and Combine.
 */
export function isValidSectionFor(sectionCount: number, section: SectionValue): boolean {
  const trimmed = section?.trim() || null;
  if (sectionCount === 2) return trimmed !== null && sectionOptionsFor(2).includes(trimmed);
  return trimmed === null;
}

/** The 400 message when a session's section doesn't fit its batch (Step 50 §7). */
export function sectionErrorFor(batch: { name: string; sectionCount: number }): string {
  return batch.sectionCount === 2
    ? `Batch ${batch.name} has two sections — choose Sec 1, Sec 2 or Both.`
    : `Batch ${batch.name} has no sections.`;
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
