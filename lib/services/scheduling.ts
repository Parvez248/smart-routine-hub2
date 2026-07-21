import { getDb } from "@/lib/db";
import { dateOnly, dayNameForDate, isOnOrAfterToday } from "@/lib/services/dates";

type ConflictInput = {
  day: string;
  timeSlotId: number;
  batchId: number;
  section?: string | null;
  teacherId: number;
  roomId: number;
  versionId: number;
  excludeSessionId?: number;
};

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

  const batchConflict = matching.find((s) => {
    if (s.batchId !== batchId) return false;
    const existSection = s.section?.trim() || null;
    return existSection === normSection;
  });
  if (batchConflict) {
    const batch = await db.batch.findUnique({ where: { id: batchId } });
    conflicts.push(
      `Batch ${batch?.name ?? batchId}${normSection ? ` (${normSection})` : ""} already has a class at this day & time.`
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

export async function checkConflictForDate(input: ConflictForDateInput): Promise<{ ok: boolean; reason?: string }> {
  const { versionId, date, timeSlotId, batchId, section, teacherId, roomId, excludeSessionId } = input;

  const effective = await getEffectiveSessionsForDate(versionId, date);
  const matching = effective.filter((s) => s.timeSlotId === timeSlotId && s.sessionId !== excludeSessionId);

  const conflicts = await buildConflictReasons(matching, { roomId, teacherId, batchId, section });
  if (conflicts.length > 0) return { ok: false, reason: conflicts.join(" ") };
  return { ok: true };
}

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
