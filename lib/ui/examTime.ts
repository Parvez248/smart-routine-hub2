// Times and dates for the exam routine (Step 49). Pure — no database import —
// so the admin builder's client components can use the same helpers the
// conflict checks in lib/services/exams.ts use, exactly as lib/ui/sections.ts
// is shared with lib/services/scheduling.ts.
//
// Exam times are stored as free-form "HH:MM" 24-hour strings rather than
// TimeSlot rows: exam lengths vary (1h30 midterm theory, 2h final theory,
// 2h labs) and don't line up with the weekly routine's six fixed periods.

/** Minutes since midnight for an "HH:MM" string, or null if malformed. */
export function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** A half-open [start, end) span, in minutes since midnight. */
export type TimeRange = { start: number; end: number };

/**
 * Do two exam time spans collide? Half-open on both sides, so exams that
 * merely touch (10:30–12:00 then 12:00–13:30) are deliberately allowed —
 * one batch can sit back-to-back exams, and a room can be reused the moment
 * the previous exam ends.
 */
export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

// `Exam.date` is `@db.Date` — a bare calendar date with no time-of-day.
// Prisma reads and writes those using a JS Date's *UTC* components, so exam
// dates are built at UTC midnight. This is why they can't reuse
// lib/services/dates.ts, whose helpers build *local* midnight: east of UTC
// (the app runs at UTC+6) local midnight is the previous day in UTC, which
// would store and display every exam one day early.
const EXAM_DAY_NAMES = ["Sun", "Mon", "Tues", "Wed", "Thu", "Fri", "Sat"];

/** Parses a strict "YYYY-MM-DD" string to UTC midnight. Null if malformed. */
export function parseExamDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rejects real-looking but invalid dates (2026-02-30 rolls over to Mar 2).
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

/** "YYYY-MM-DD" for an exam date — read from UTC parts, never local ones. */
export function formatExamDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * The weekday name for an exam date. Unlike the weekly routine's
 * CLASS_DAYS (Sat–Wed), this covers all seven days: exams are routinely
 * held on Thursdays and Saturdays, which are never class days.
 */
export function examDayName(date: Date): string {
  return EXAM_DAY_NAMES[date.getUTCDay()];
}

/** "14:30" → "2:30 PM". Exam times are written 12-hour on printed routines. */
export function formatTime12(value: string): string {
  const minutes = timeToMinutes(value);
  if (minutes === null) return value;
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 < 12 ? "AM" : "PM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, "0")} ${suffix}`;
}

/** "10:30"+"12:00" → "10:30 AM – 12:00 PM". */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTime12(startTime)} – ${formatTime12(endTime)}`;
}

/**
 * The exam slots this department actually uses, offered as one-click presets
 * in the add/edit dialog. Stored 24-hour; `label` is how the printed routine
 * writes them. Not a constraint — the dialog still allows any start/end, since
 * a make-up or practical exam occasionally falls outside these.
 */
export const EXAM_TIME_PRESETS = [
  { label: "10:30 – 12:00", startTime: "10:30", endTime: "12:00" },
  { label: "10:30 – 12:30", startTime: "10:30", endTime: "12:30" },
  { label: "10:00 – 12:00", startTime: "10:00", endTime: "12:00" },
  { label: "02:00 – 04:00", startTime: "14:00", endTime: "16:00" },
  { label: "02:30 – 04:30", startTime: "14:30", endTime: "16:30" },
] as const;
