// Maps batch seniority (semester) to its depth-of-colour band (see app/globals.css
// --band-1..4 / --band-x). One hue family; the more senior the batch, the deeper
// its shade. Never hard-code these hexes in a page — read them through here.
export type Band = "band-1" | "band-2" | "band-3" | "band-4" | "band-x";

function semesterNumber(semester: string): number | null {
  const match = semester.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/** 8th/7th = band-1 (most senior, deepest) … 2nd/1st = band-4 (most junior, lightest). */
export function bandForSemester(semester: string): Band {
  const n = semesterNumber(semester);
  if (n === null) return "band-x";
  if (n >= 7) return "band-1";
  if (n >= 5) return "band-2";
  if (n >= 3) return "band-3";
  if (n >= 1) return "band-4";
  return "band-x";
}

const BAND_VAR: Record<Band, string> = {
  "band-1": "--band-1",
  "band-2": "--band-2",
  "band-3": "--band-3",
  "band-4": "--band-4",
  "band-x": "--band-x",
};

const BAND_TEXT_VAR: Record<Band, string> = {
  "band-1": "--band-1-text",
  "band-2": "--band-2-text",
  "band-3": "--band-3-text",
  "band-4": "--band-4-text",
  "band-x": "--band-x-text",
};

/** CSS var() reference for a band's base colour, e.g. for a solid spine/left edge/fill. */
export function bandVar(band: Band): string {
  return `var(${BAND_VAR[band]})`;
}

/** CSS var() reference for the readable text colour on a filled band background. */
export function bandTextVar(band: Band): string {
  return `var(${BAND_TEXT_VAR[band]})`;
}

/** A faint over-surface tint of the band, for quiet backgrounds (e.g. outlined pill hover, empty grid cells). */
export function bandTint(band: Band, percent = 8): string {
  return `color-mix(in srgb, ${bandVar(band)} ${percent}%, var(--surface))`;
}

/** Tailwind arbitrary-value class for a 4px left-edge/spine border in the band's colour. */
export function bandEdgeClass(band: Band): string {
  return `shadow-[inset_4px_0_0_0_${bandVar(band)}]`;
}

/** Convenience: band for a batch object shaped like { semester }. */
export function bandForBatch(batch: { semester: string }): Band {
  return bandForSemester(batch.semester);
}
