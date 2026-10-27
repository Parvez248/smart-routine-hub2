// Times and dates for the exam routine. Pure — no database import — so the
// admin builder's client components can use the same helpers the conflict
// checks in lib/services/exams.ts use, exactly as lib/ui/sections.ts is
// shared with lib/services/scheduling.ts.
//
// Exam times are stored as "HH:MM" 24-hour strings rather than TimeSlot rows:
// exam lengths vary (1h30 midterm theory, 2h final theory, 2h labs) and don't
// line up with the weekly routine's six fixed periods. Since Step 49b each
// exam also belongs to a *sitting* — morning or afternoon — and the times
// have to fall inside it.
import type { ExamSittingValue, ExamTypeValue } from "@/lib/ui/examType";

/** Minutes since midnight for an "HH:MM" string, or null if malformed. */
export function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Minutes since midnight back to "HH:MM"; clamped to the end of the day. */
export function minutesToTime(minutes: number): string {
  const capped = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  return `${String(Math.floor(capped / 60)).padStart(2, "0")}:${String(capped % 60).padStart(2, "0")}`;
}

/** "10:30" + 90 → "12:00". Returns null if the start time is malformed. */
export function addMinutes(startTime: string, minutes: number): string | null {
  const start = timeToMinutes(startTime);
  if (start === null) return null;
  return minutesToTime(start + minutes);
}

// The boundary between the two sittings. A morning exam has to be finished
// by 13:30 and an afternoon one can't start before 13:00 — the overlap
// between the two is deliberate, since the hall is cleared and re-seated in
// between rather than at one exact instant.
export const MORNING_LATEST_END = "13:30";
export const AFTERNOON_EARLIEST_START = "13:00";

/**
 * Why these times don't fit the chosen sitting, or null if they do. The
 * exam routes return this as a 400 (it's a malformed request, not a
 * scheduling clash), and the dialog shows it before letting the admin save.
 */
export function sittingTimeError(
  sitting: ExamSittingValue,
  startTime: string,
  endTime: string
): string | null {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null) return "Start and end time must both be in HH:MM (24-hour) form.";
  if (end <= start) return "The exam must end after it starts.";

  if (sitting === "MORNING" && end > timeToMinutes(MORNING_LATEST_END)!) {
    return `A morning exam must end by ${formatTime12(MORNING_LATEST_END)}.`;
  }
  if (sitting === "AFTERNOON" && start < timeToMinutes(AFTERNOON_EARLIEST_START)!) {
    return `An afternoon exam must start at or after ${formatTime12(AFTERNOON_EARLIEST_START)}.`;
  }
  return null;
}

/**
 * How long an exam of this kind runs. Labs are always two hours whichever
 * term exam it is; a theory midterm is an hour and a half and a theory
 * final two hours. Used only to fill the end time in the dialog — the admin
 * can still change it, so this is a default, not a rule.
 */
export function examDurationMinutes(type: ExamTypeValue, courseType: string | undefined): number {
  if (courseType === "LAB") return 120;
  return type === "MIDTERM" ? 90 : 120;
}

/** The start/end a new exam should open with, from its term and kind. */
export function defaultTimesFor(
  term: { morningStart: string; afternoonStart: string },
  sitting: ExamSittingValue,
  type: ExamTypeValue,
  courseType: string | undefined
): { startTime: string; endTime: string } {
  const startTime = sitting === "MORNING" ? term.morningStart : term.afternoonStart;
  const endTime = addMinutes(startTime, examDurationMinutes(type, courseType)) ?? startTime;
  return { startTime, endTime };
}

/** The sitting a time belongs to — used to default the picker sensibly. */
export function sittingForTime(startTime: string): ExamSittingValue {
  const start = timeToMinutes(startTime);
  if (start === null) return "MORNING";
  return start >= timeToMinutes(AFTERNOON_EARLIEST_START)! ? "AFTERNOON" : "MORNING";
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
