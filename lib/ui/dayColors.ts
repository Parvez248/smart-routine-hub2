// Maps a class-day code to its design tokens (see app/globals.css). Every day
// owns a colour so a routine is visually navigable before a word is read.
// Never hard-code the hexes elsewhere — read them through this helper.
export type DayCode = "Sat" | "Sun" | "Mon" | "Tues" | "Wed";

const DAY_VAR: Record<DayCode, { from: string; to: string }> = {
  Sat: { from: "--day-sat-from", to: "--day-sat-to" },
  Sun: { from: "--day-sun-from", to: "--day-sun-to" },
  Mon: { from: "--day-mon-from", to: "--day-mon-to" },
  Tues: { from: "--day-tues-from", to: "--day-tues-to" },
  Wed: { from: "--day-wed-from", to: "--day-wed-to" },
};

function isDayCode(day: string): day is DayCode {
  return day in DAY_VAR;
}

/** CSS var() reference for a day's base (gradient "from") colour, e.g. for a solid spine or icon tint. */
export function daySolidVar(day: string): string {
  return isDayCode(day) ? `var(${DAY_VAR[day].from})` : "var(--slate)";
}

/** A 135° gradient background-image string, e.g. for `style={{ backgroundImage: dayGradient(day) }}`. */
export function dayGradient(day: string): string {
  if (!isDayCode(day)) return "linear-gradient(135deg, var(--slate), var(--slate))";
  const { from, to } = DAY_VAR[day];
  return `linear-gradient(135deg, var(${from}), var(${to}))`;
}

/** Tailwind arbitrary-value class for a 4px inset "spine" border in the day's colour. */
export function daySpineClass(day: string): string {
  return `shadow-[inset_4px_0_0_0_${isDayCode(day) ? `var(${DAY_VAR[day].from})` : "var(--slate)"}]`;
}

// Widened to string[] so callers can index/compare against plain `day: string` fields
// (e.g. Array.prototype.indexOf) without a DayCode cast at every call site.
export const DAY_ORDER: string[] = ["Sat", "Sun", "Mon", "Tues", "Wed"];
export const DAY_NAME: Record<DayCode, string> = {
  Sat: "Saturday",
  Sun: "Sunday",
  Mon: "Monday",
  Tues: "Tuesday",
  Wed: "Wednesday",
};
