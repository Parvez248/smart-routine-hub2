export type StartTime = { hour: number; minute: number };

type ClockPart = { hour: number; minute: number; period: "am" | "pm" | null };

function parseClockPart(part: string): ClockPart | null {
  const match = part.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;

  const period = match[3] ? (match[3].toLowerCase() as "am" | "pm") : null;
  return { hour, minute, period };
}

function to24HourMinutes(hour: number, minute: number, period: "am" | "pm"): number {
  const h = hour % 12;
  return (period === "pm" ? h + 12 : h) * 60 + minute;
}

/**
 * Parses a TimeSlot.label such as "09:30 – 10:30 am" or "11:30 – 12:30 pm" into
 * the slot's 24-hour start time. The start side of the label usually has no
 * am/pm of its own, so both interpretations are tried and whichever yields a
 * short positive duration before the (explicit) end time wins — this is what
 * correctly resolves the "11:30 – 12:30 pm" (AM start, PM end) case.
 * Returns null (never throws) if the label doesn't match the expected shape.
 */
export function parseTimeSlotStart(label: string): StartTime | null {
  const parts = label.split(/[-–—]/);
  if (parts.length !== 2) return null;

  const startRaw = parseClockPart(parts[0]);
  const endRaw = parseClockPart(parts[1]);
  if (!startRaw || !endRaw || !endRaw.period) return null;

  const endMinutes = to24HourMinutes(endRaw.hour, endRaw.minute, endRaw.period);
  const candidatePeriods: ("am" | "pm")[] = startRaw.period
    ? [startRaw.period]
    : [endRaw.period, endRaw.period === "am" ? "pm" : "am"];

  for (const period of candidatePeriods) {
    const startMinutes = to24HourMinutes(startRaw.hour, startRaw.minute, period);
    const duration = endMinutes - startMinutes;
    if (duration > 0 && duration <= 180) {
      return { hour: Math.floor(startMinutes / 60), minute: startMinutes % 60 };
    }
  }

  return null;
}

const DAY_TO_JS_WEEKDAY: Record<string, number> = { Sat: 6, Sun: 0, Mon: 1, Tues: 2, Wed: 3 };

/**
 * Returns the next Date (today or a future day, never in the past) on which
 * the given routine day + TimeSlot.label next occurs, relative to `now`.
 * Returns null if the day name or label can't be parsed.
 */
export function nextOccurrenceOf(day: string, label: string, now: Date): Date | null {
  const start = parseTimeSlotStart(label);
  const jsDay = DAY_TO_JS_WEEKDAY[day];
  if (!start || jsDay === undefined) return null;

  const daysAhead = (jsDay - now.getDay() + 7) % 7;
  const occurrence = new Date(now);
  occurrence.setDate(now.getDate() + daysAhead);
  occurrence.setHours(start.hour, start.minute, 0, 0);
  if (occurrence <= now) {
    occurrence.setDate(occurrence.getDate() + 7);
  }
  return occurrence;
}
