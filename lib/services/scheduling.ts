/**
 * The scheduling engine — the heart of the app.
 *
 * Every write to the routine (create/edit a session, cancel/restore it,
 * request or approve a reschedule) must pass through here first. The core
 * idea is the "effective schedule": what is *actually* being taught, once
 * cancellations and approved reschedules are folded in — not just the raw
 * `Session` rows. All conflict checks run against the effective schedule,
 * never against raw rows, because a cancelled class or one that has been
 * permanently moved must not still "occupy" its old room/teacher/slot.
 *
 * Two effective-schedule views exist because the app has two kinds of
 * reschedule:
 *  - a *legacy/permanent* override (`Reschedule.originalDate === null`)
 *    changes the class every week going forward — reflected in the
 *    *weekly* view (`getEffectiveSessions`);
 *  - a *dated* override (`Reschedule.originalDate` set) moves just one
 *    calendar occurrence — reflected only in the *date* view
 *    (`getEffectiveSessionsForDate`), the weekly pattern is untouched.
 *
 * The section rule lives in `lib/ui/sections.ts` (`sectionsIntersect`) and
 * is applied here, not re-implemented: a `"Both"` class occupies its
 * room/teacher once but conflicts with either concrete section, while
 * `"Sec 1"` and `"Sec 2"` are allowed to run in parallel (different rooms).
 */
import { getDb } from "@/lib/db";
import { dateOnly, dayNameForDate, isOnOrAfterToday } from "@/lib/services/dates";
import { sectionsIntersect, sectionLabel } from "@/lib/ui/sections";

// Input for checkConflict — a *weekly* (day-of-week) placement, checked
// against every other active session's effective weekly slot.
type ConflictInput = {
  day: string;
  timeSlotId: number;
  batchId: number;
  section?: string | null;
  teacherId: number;
  roomId: number;
  versionId: number;
  // Pass the session's own id when editing it, so it doesn't conflict with itself.
  excludeSessionId?: number;
};

// Input for checkConflictForDate — a placement on one specific calendar
// date, checked against what is actually taught that date (dated overrides
// applied), used for reschedule requests/approvals.
type ConflictForDateInput = {
  versionId: number;
  date: Date;
  timeSlotId: number;
  batchId: number;
  section?: string | null;
  teacherId: number;
  roomId: number;
  excludeSessionId?: number;
};

// One session's place in an effective schedule (weekly or date-specific):
// the day/slot/room it's *actually* at right now, plus its original values
// so callers (e.g. routine views) can show "moved from ... to ...".
export type EffectiveSession = {
  sessionId: number;
  day: string;
  timeSlotId: number;
  roomId: number;
  teacherId: number;
  batchId: number;
  section: string | null;
  isRescheduled: boolean;
  originalDay: string;
  originalTimeSlotId: number;
  originalRoomId: number;
};

// Shared by checkConflict and checkConflictForDate: given the list of
// sessions already occupying the target day+slot ("matching" — the caller
// has already filtered the effective schedule down to that slot), decide
// whether placing a new/edited session there is allowed. Three independent
// rules, all of which can fire at once (reasons are joined, not short-circuited):
// a room can't host two classes at once, a teacher can't teach two classes
// at once, and a batch can't have two overlapping-section classes at once.
async function buildConflictReasons(
  matching: EffectiveSession[],
  { roomId, teacherId, batchId, section }: { roomId: number; teacherId: number; batchId: number; section?: string | null }
): Promise<string[]> {
  const db = getDb();
  const conflicts: string[] = [];
  const normSection = section?.trim() || null;

  const roomConflict = matching.find((s) => s.roomId === roomId);
  if (roomConflict) {
    const room = await db.room.findUnique({ where: { id: roomId } });
    conflicts.push(`Room ${room?.name ?? roomId} is already booked at this day & time.`);
  }

  const teacherConflict = matching.find((s) => s.teacherId === teacherId);
  if (teacherConflict) {
    const teacher = await db.teacher.findUnique({ where: { id: teacherId } });
    conflicts.push(`${teacher?.initials ?? "This teacher"} already has a class at this day & time.`);
  }

  // A "Both" class occupies its room/teacher/time once but covers both
  // sections — it must conflict with a separate Sec 1/Sec 2 class for the
  // same batch+slot (their covered sections overlap), but two sections
  // running in parallel (Sec 1 vs Sec 2, in different rooms) do not.
  const batchConflict = matching.find((s) => {
    if (s.batchId !== batchId) return false;
    return sectionsIntersect(s.section, normSection);
  });
  if (batchConflict) {
    const batch = await db.batch.findUnique({ where: { id: batchId } });
    const label = sectionLabel(normSection);
    conflicts.push(
      `Batch ${batch?.name ?? batchId}${label ? ` (${label})` : ""} already has a class at this day & time.`
    );
  }

  return conflicts;
}

// Returns the *weekly* schedule as it is normally taught:
//   - skips sessions with status = "CANCELLED"
//   - if a session has a legacy permanent override (Reschedule: status APPROVED,
//     appliedToMaster = false, originalDate = null), uses its new day / timeSlotId / roomId
//   - otherwise uses the session's own values
// Date-specific (one-occurrence) overrides do NOT affect this weekly view — see
// getEffectiveSessionsForDate for what is actually taught on one calendar date.
export async function getEffectiveSessions(versionId: number): Promise<EffectiveSession[]> {
  const db = getDb();
  const sessions = await db.session.findMany({ where: { versionId, status: "ACTIVE" } });
  const sessionIds = sessions.map((s) => s.id);

  const overrides = sessionIds.length
    ? await db.reschedule.findMany({
        where: { sessionId: { in: sessionIds }, status: "APPROVED", appliedToMaster: false, originalDate: null },
      })
    : [];
  const overrideBySessionId = new Map(overrides.map((o) => [o.sessionId, o]));

  return sessions.map((s) => {
    const override = overrideBySessionId.get(s.id);
    return {
      sessionId: s.id,
      day: override ? override.newDay : s.day,
      timeSlotId: override ? override.newTimeSlotId : s.timeSlotId,
      roomId: override ? override.newRoomId : s.roomId,
      teacherId: s.teacherId,
      batchId: s.batchId,
      section: s.section,
      isRescheduled: Boolean(override),
      originalDay: s.day,
      originalTimeSlotId: s.timeSlotId,
      originalRoomId: s.roomId,
    };
  });
}

// What is actually taught on one specific calendar date:
//   1. Start from ACTIVE sessions of this version whose weekly `day` equals the date's weekday.
//   2. Apply legacy permanent overrides (same as the weekly view).
//   3. Remove sessions that have a dated APPROVED override moving them away from this date.
//   4. Add sessions that have a dated APPROVED override moving them onto this date, positioned
//      at that override's new time slot / room (their own day may differ from this date's weekday).
export async function getEffectiveSessionsForDate(versionId: number, date: Date): Promise<EffectiveSession[]> {
  const db = getDb();
  const target = dateOnly(date);
  const dayName = dayNameForDate(target);
  if (!dayName) return [];

  const daySessions = await db.session.findMany({ where: { versionId, status: "ACTIVE", day: dayName } });
  const daySessionIds = daySessions.map((s) => s.id);

  const legacyOverrides = daySessionIds.length
    ? await db.reschedule.findMany({
        where: { sessionId: { in: daySessionIds }, status: "APPROVED", appliedToMaster: false, originalDate: null },
      })
    : [];
  const legacyBySessionId = new Map(legacyOverrides.map((o) => [o.sessionId, o]));

  const movedAway = daySessionIds.length
    ? await db.reschedule.findMany({
        where: { sessionId: { in: daySessionIds }, status: "APPROVED", appliedToMaster: false, originalDate: target },
      })
    : [];
  const movedAwaySessionIds = new Set(movedAway.map((o) => o.sessionId));

  const movedInOverrides = await db.reschedule.findMany({
    where: { status: "APPROVED", appliedToMaster: false, newDate: target },
  });
  const movedInSessionIds = new Set(movedInOverrides.map((o) => o.sessionId));

  const base: EffectiveSession[] = daySessions
    .filter((s) => !movedAwaySessionIds.has(s.id) && !movedInSessionIds.has(s.id))
    .map((s) => {
      const legacy = legacyBySessionId.get(s.id);
      return {
        sessionId: s.id,
        day: legacy ? legacy.newDay : s.day,
        timeSlotId: legacy ? legacy.newTimeSlotId : s.timeSlotId,
        roomId: legacy ? legacy.newRoomId : s.roomId,
        teacherId: s.teacherId,
        batchId: s.batchId,
        section: s.section,
        isRescheduled: Boolean(legacy),
        originalDay: s.day,
        originalTimeSlotId: s.timeSlotId,
        originalRoomId: s.roomId,
      };
    });

  const movedInSessions = movedInSessionIds.size
    ? await db.session.findMany({ where: { id: { in: [...movedInSessionIds] }, versionId, status: "ACTIVE" } })
    : [];
  const movedInSessionById = new Map(movedInSessions.map((s) => [s.id, s]));

  const additions: EffectiveSession[] = movedInOverrides.flatMap((o) => {
    const s = movedInSessionById.get(o.sessionId);
    if (!s) return [];
    return [
      {
        sessionId: s.id,
        day: dayName,
        timeSlotId: o.newTimeSlotId,
        roomId: o.newRoomId,
        teacherId: s.teacherId,
        batchId: s.batchId,
        section: s.section,
        isRescheduled: true,
        originalDay: s.day,
        originalTimeSlotId: s.timeSlotId,
        originalRoomId: s.roomId,
      },
    ];
  });

  return [...base, ...additions];
}

/**
 * Weekly-pattern conflict check. Used when creating/editing a master
 * `Session` (POST/PATCH /api/sessions) and when cancelling/restoring one
 * (PATCH /api/sessions/[id]/status) — every path that changes what is
 * taught *every week*, not just once. Builds the current effective weekly
 * schedule, narrows it to the same day+slot, and checks room/teacher/batch
 * conflicts against that set (see buildConflictReasons).
 */
export async function checkConflict(input: ConflictInput): Promise<{ ok: boolean; reason?: string }> {
  const { day, timeSlotId, batchId, section, teacherId, roomId, versionId, excludeSessionId } = input;

  const effective = await getEffectiveSessions(versionId);
  const matching = effective.filter(
    (s) => s.day === day && s.timeSlotId === timeSlotId && s.sessionId !== excludeSessionId
  );

  const conflicts = await buildConflictReasons(matching, { roomId, teacherId, batchId, section });
  if (conflicts.length > 0) return { ok: false, reason: conflicts.join(" ") };
  return { ok: true };
}

/**
 * One-occurrence conflict check, for reschedule requests/approvals: is the
 * target room/teacher/batch free on this specific calendar date and slot,
 * given what is *actually* being taught that date (other dated moves
 * already applied)? Deliberately re-checked at approval time too — the
 * slot may have been taken by something else between when the teacher
 * requested it and when the admin approves it.
 */
export async function checkConflictForDate(input: ConflictForDateInput): Promise<{ ok: boolean; reason?: string }> {
  const { versionId, date, timeSlotId, batchId, section, teacherId, roomId, excludeSessionId } = input;

  const effective = await getEffectiveSessionsForDate(versionId, date);
  const matching = effective.filter((s) => s.timeSlotId === timeSlotId && s.sessionId !== excludeSessionId);

  const conflicts = await buildConflictReasons(matching, { roomId, teacherId, batchId, section });
  if (conflicts.length > 0) return { ok: false, reason: conflicts.join(" ") };
  return { ok: true };
}

// Can this room physically hold this batch? Checked alongside every
// conflict check above (same call sites) — a slot can be conflict-free but
// still the wrong-sized room.
export async function checkCapacity(
  roomId: number,
  batchId: number
): Promise<{ ok: boolean; reason?: string; roomCapacity?: number; studentCount?: number }> {
  const db = getDb();
  const [room, batch] = await Promise.all([
    db.room.findUnique({ where: { id: roomId } }),
    db.batch.findUnique({ where: { id: batchId } }),
  ]);

  if (!room || !batch) {
    return { ok: false, reason: "Invalid room or batch" };
  }

  if (room.capacity < batch.studentCount) {
    return {
      ok: false,
      reason: `Room capacity (${room.capacity}) is less than the batch student count (${batch.studentCount})`,
      roomCapacity: room.capacity,
      studentCount: batch.studentCount,
    };
  }

  return { ok: true, roomCapacity: room.capacity, studentCount: batch.studentCount };
}

// "Find Free Rooms" (weekly view) — every room not already booked by the
// effective weekly schedule at this day+slot. Room-only; doesn't consider
// teacher or batch, since the point is just "which rooms could I use here".
export async function getFreeRooms(day: string, timeSlotId: number, versionId: number) {
  const db = getDb();
  const [rooms, effective] = await Promise.all([
    db.room.findMany({ orderBy: { name: "asc" } }),
    getEffectiveSessions(versionId),
  ]);

  const bookedRoomIds = new Set(
    effective.filter((s) => s.day === day && s.timeSlotId === timeSlotId).map((s) => s.roomId)
  );
  return rooms.filter((r) => !bookedRoomIds.has(r.id));
}

// Same as getFreeRooms, but for one calendar date — used when picking a
// room for a reschedule request/approval, against what's actually taught
// that date rather than the weekly pattern.
export async function getFreeRoomsForDate(versionId: number, date: Date, timeSlotId: number) {
  const db = getDb();
  const [rooms, effective] = await Promise.all([
    db.room.findMany({ orderBy: { name: "asc" } }),
    getEffectiveSessionsForDate(versionId, date),
  ]);

  const bookedRoomIds = new Set(effective.filter((s) => s.timeSlotId === timeSlotId).map((s) => s.roomId));
  return rooms.filter((r) => !bookedRoomIds.has(r.id));
}

// Active overrides (approved, not yet folded into master), keyed by sessionId — for badges on
// weekly routine views. A legacy permanent override always wins; otherwise the soonest upcoming
// dated override is used. Past dated overrides are not returned (their one occurrence is done).
export async function getActiveOverrides(sessionIds: number[]) {
  const db = getDb();
  const overrides = sessionIds.length
    ? await db.reschedule.findMany({
        where: { sessionId: { in: sessionIds }, status: "APPROVED", appliedToMaster: false },
      })
    : [];

  const bySession = new Map<number, (typeof overrides)[number]>();
  for (const o of overrides) {
    if (o.originalDate === null) bySession.set(o.sessionId, o);
  }

  const datedUpcoming = overrides
    .filter((o) => o.originalDate !== null && o.newDate && isOnOrAfterToday(o.newDate))
    .sort((a, b) => a.newDate!.getTime() - b.newDate!.getTime());
  for (const o of datedUpcoming) {
    if (!bySession.has(o.sessionId)) bySession.set(o.sessionId, o);
  }

  return bySession;
}
