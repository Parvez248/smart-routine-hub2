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
