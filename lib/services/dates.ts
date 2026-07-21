// Date helpers for the routine's plain calendar dates (no time-of-day).
// Days are always local calendar dates — a class never shifts a day because
// of timezone/time-of-day noise.

export const CLASS_DAYS = ["Sat", "Sun", "Mon", "Tues", "Wed"] as const;
export const MAX_RESCHEDULE_WINDOW_DAYS = 90;

const DAY_TO_JS_WEEKDAY: Record<string, number> = { Sat: 6, Sun: 0, Mon: 1, Tues: 2, Wed: 3 };
const JS_WEEKDAY_TO_DAY: Record<number, string> = { 6: "Sat", 0: "Sun", 1: "Mon", 2: "Tues", 3: "Wed" };

/** Strips the time-of-day, keeping only the local calendar date. */
export function dateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function today(): Date {
  return dateOnly(new Date());
}

/** Parses a strict "YYYY-MM-DD" string into a local calendar date. Returns null if malformed. */
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isSameDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isOnOrAfterToday(date: Date): boolean {
  return dateOnly(date).getTime() >= today().getTime();
}

export function isBeforeToday(date: Date): boolean {
  return dateOnly(date).getTime() < today().getTime();
}

/** The routine day name ("Sat".."Wed") for a date, or null if it's Thu/Fri (not a class day). */
export function dayNameForDate(date: Date): string | null {
  return JS_WEEKDAY_TO_DAY[date.getDay()] ?? null;
}

export function isClassDay(date: Date): boolean {
  return dayNameForDate(date) !== null;
}

export function isWithinReschedulingWindow(date: Date, from: Date = new Date()): boolean {
  const diffDays = (dateOnly(date).getTime() - dateOnly(from).getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= MAX_RESCHEDULE_WINDOW_DAYS;
}

/** The next `count` upcoming occurrences (today or later) of the given routine day. */
export function nextOccurrences(day: string, count: number, from: Date = new Date()): Date[] {
  const jsDay = DAY_TO_JS_WEEKDAY[day];
  if (jsDay === undefined) return [];

  const start = dateOnly(from);
  const daysAhead = (jsDay - start.getDay() + 7) % 7;
  const first = new Date(start);
  first.setDate(start.getDate() + daysAhead);

  const results: Date[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() + i * 7);
    results.push(d);
  }
  return results;
}
