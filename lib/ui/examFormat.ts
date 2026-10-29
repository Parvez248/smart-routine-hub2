// Display formatting for the exam routine (Step 51) — screen views and the
// printed documents. Pure: no database import, so the read-only pages and
// the print components share one set of rules.
//
// Two things to know about dates here:
//
//  1. An exam date is a plain calendar date, carried around as a
//     "YYYY-MM-DD" string. Everything below is built from its parts (or
//     read in UTC), never through the browser's local time zone, which
//     would shift the date a day for anyone west of UTC — the same rule
//     lib/ui/examTime.ts follows for the database side.
//  2. "Today" is the current date in Asia/Dhaka, not in whatever zone the
//     viewer's machine is set to, so a student abroad still sees the same
//     exam marked as next.
//
// Note `formatExamDate` here takes a "YYYY-MM-DD" string and returns a
// human date ("07 Dec 2025"); the same-named helper in examTime.ts does the
// opposite job (a Date to "YYYY-MM-DD" for the database).
import type { ExamSittingValue, ExamTypeValue } from "@/lib/ui/examType";
import { timeToMinutes } from "@/lib/ui/examTime";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** One exam as the read-only views and the print documents receive it. */
export type ViewExam = {
  id: number;
  type: ExamTypeValue;
  date: string;
  sitting: ExamSittingValue;
  startTime: string;
  endTime: string;
  course: { code: string; title: string; type: string };
  batch: { id: number; name: string; semester: string };
  section: string | null;
  rooms: { name: string; capacity: number; seats: number | null }[];
};

/** "2025-12-07" → "07 Dec 2025". Built from the string's own parts. */
export function formatExamDate(date: string): string {
  const [y, m, d] = date.split("-");
  const month = MONTHS[Number(m) - 1];
  if (!y || !month || !d) return date;
  return `${d} ${month} ${y}`;
}

/** "2025-12-07" → "Sunday". Read in UTC so the day never slips. */
export function weekdayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return "";
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** The short form for tight columns — "Sun 07 Dec". */
export function formatExamDateShort(date: string): string {
  const [, m, d] = date.split("-");
  return `${weekdayOf(date).slice(0, 3)} ${d} ${MONTHS[Number(m) - 1]}`;
}

/** "14:30" → "02:30 PM" (two-digit hour, so printed columns line up). */
export function formatTime12(value: string): string {
  const minutes = timeToMinutes(value);
  if (minutes === null) return value;
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 < 12 ? "AM" : "PM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${String(hours12).padStart(2, "0")}:${String(mins).padStart(2, "0")} ${suffix}`;
}

/** "10:30" + "12:00" → "10:30 AM – 12:00 PM". */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTime12(startTime)} – ${formatTime12(endTime)}`;
}

/** Today's calendar date in Asia/Dhaka, as "YYYY-MM-DD" ("en-CA" gives that). */
export function todayInDhaka(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Whole days from `from` to `to`; negative when `to` is in the past. */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / 86_400_000);
}

/** "today", "tomorrow", "in 3 days", "in 2 weeks" — for the next-exam card. */
export function relativeDayLabel(from: string, to: string): string {
  const days = daysBetween(from, to);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} ago`;
  if (days < 14) return `in ${days} days`;
  return `in ${Math.floor(days / 7)} weeks`;
}

/** An exam is past once its date is behind today (whole days only). */
export function isPastExam(exam: ViewExam, today: string): boolean {
  return daysBetween(today, exam.date) < 0;
}

/** The soonest exam today or later — what the "Next" badge and card mark. */
export function nextExamOf(exams: ViewExam[], today: string): ViewExam | null {
  const upcoming = exams
    .filter((e) => daysBetween(today, e.date) >= 0)
    .sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)));
  return upcoming[0] ?? null;
}

/** Two-digit counts, as the printed summary line writes them ("05"). */
export function padCount(n: number): string {
  return String(n).padStart(2, "0");
}

export function isLab(exam: ViewExam): boolean {
  return exam.course.type === "LAB";
}

// --- grouping for the printed exam routine ---------------------------------

export type PrintBatchGroup = {
  batch: { id: number; name: string; semester: string };
  midterm: ViewExam[];
  final: ViewExam[];
  counts: { midterm: number; final: number; lab: number };
};

/**
 * One group per batch, each with its midterm and final lists in date order
 * and the three counts the printed summary line shows. Lab exams are not
 * pulled into a list of their own — they stay among the finals, in date
 * order — but they are counted separately, as the department's own routine
 * does.
 */
export function groupForPrint(exams: ViewExam[]): PrintBatchGroup[] {
  const byBatch = new Map<number, PrintBatchGroup>();

  for (const exam of exams) {
    let group = byBatch.get(exam.batch.id);
    if (!group) {
      group = { batch: exam.batch, midterm: [], final: [], counts: { midterm: 0, final: 0, lab: 0 } };
      byBatch.set(exam.batch.id, group);
    }
    if (exam.type === "MIDTERM") {
      group.midterm.push(exam);
      group.counts.midterm++;
    } else {
      group.final.push(exam);
      group.counts.final++;
    }
    if (isLab(exam)) group.counts.lab++;
  }

  const byDateThenTime = (a: ViewExam, b: ViewExam) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date);

  const groups = [...byBatch.values()];
  for (const group of groups) {
    group.midterm.sort(byDateThenTime);
    group.final.sort(byDateThenTime);
  }
  return groups.sort((a, b) => a.batch.name.localeCompare(b.batch.name, undefined, { numeric: true }));
}

// --- grouping for the room-wise sitting sheet ------------------------------

export type SittingSheetRow = {
  batch: string;
  section: string | null;
  course: string;
  isLab: boolean;
  time: string;
  seats: number | null;
};

export type SittingSheetRoom = {
  name: string;
  capacity: number;
  seatsUsed: number;
  hasUnknownSeats: boolean;
  rows: SittingSheetRow[];
};

export type SittingSheetBlock = {
  sitting: ExamSittingValue;
  timeRange: string;
  rooms: SittingSheetRoom[];
};

export type SittingSheetDay = {
  date: string;
  weekday: string;
  blocks: SittingSheetBlock[];
};

/**
 * The same exams turned inside out: by date, then sitting, then room — who
 * sits where, and how many seats of each room are taken. This is the view
 * an invigilation desk needs, and the one the Step 49b capacity rule is
 * really about.
 */
export function buildSittingSheet(exams: ViewExam[]): SittingSheetDay[] {
  const days = new Map<string, Map<ExamSittingValue, Map<string, SittingSheetRoom>>>();
  // Earliest start and latest end per date+sitting, for the block heading.
  const spans = new Map<string, { start: string; end: string }>();

  for (const exam of exams) {
    if (!days.has(exam.date)) days.set(exam.date, new Map());
    const sittings = days.get(exam.date)!;
    if (!sittings.has(exam.sitting)) sittings.set(exam.sitting, new Map());
    const rooms = sittings.get(exam.sitting)!;

    const spanKey = `${exam.date}|${exam.sitting}`;
    const span = spans.get(spanKey);
    if (!span) {
      spans.set(spanKey, { start: exam.startTime, end: exam.endTime });
    } else {
      if (exam.startTime < span.start) span.start = exam.startTime;
      if (exam.endTime > span.end) span.end = exam.endTime;
    }

    for (const room of exam.rooms) {
      let entry = rooms.get(room.name);
      if (!entry) {
        entry = { name: room.name, capacity: room.capacity, seatsUsed: 0, hasUnknownSeats: false, rows: [] };
        rooms.set(room.name, entry);
      }
      entry.rows.push({
        batch: exam.batch.name,
        section: exam.section,
        course: exam.course.code,
        isLab: isLab(exam),
        time: formatTimeRange(exam.startTime, exam.endTime),
        seats: room.seats,
      });
      if (room.seats === null) entry.hasUnknownSeats = true;
      else entry.seatsUsed += room.seats;
    }
  }

  const sittingOrder: ExamSittingValue[] = ["MORNING", "AFTERNOON"];

  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sittings]) => ({
      date,
      weekday: weekdayOf(date),
      blocks: sittingOrder
        .filter((s) => sittings.has(s))
        .map((sitting) => {
          const span = spans.get(`${date}|${sitting}`)!;
          return {
            sitting,
            timeRange: formatTimeRange(span.start, span.end),
            rooms: [...sittings.get(sitting)!.values()].sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { numeric: true })
            ),
          };
        }),
    }));
}
