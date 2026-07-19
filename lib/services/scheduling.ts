import { getDb } from "@/lib/db";

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

// Returns the schedule as it is actually taught:
//   - skips sessions with status = "CANCELLED"
//   - if a session has an active override (Reschedule: status APPROVED, appliedToMaster = false),
//     uses its new day / timeSlotId / roomId instead of the session's own values
//   - otherwise uses the session's own values
export async function getEffectiveSessions(versionId: number): Promise<EffectiveSession[]> {
  const db = getDb();
  const sessions = await db.session.findMany({ where: { versionId, status: "ACTIVE" } });
  const sessionIds = sessions.map((s) => s.id);

  const overrides = sessionIds.length
    ? await db.reschedule.findMany({
        where: { sessionId: { in: sessionIds }, status: "APPROVED", appliedToMaster: false },
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

export async function checkConflict(
  input: ConflictInput
): Promise<{ ok: boolean; reason?: string }> {
  const { day, timeSlotId, batchId, section, teacherId, roomId, versionId, excludeSessionId } = input;
  const db = getDb();

  const effective = await getEffectiveSessions(versionId);
  const matching = effective.filter(
    (s) => s.day === day && s.timeSlotId === timeSlotId && s.sessionId !== excludeSessionId
  );

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

  if (conflicts.length > 0) {
    return { ok: false, reason: conflicts.join(" ") };
  }
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

// Active overrides (approved, not yet folded into master) for a set of sessions, keyed by sessionId.
export async function getActiveOverrides(sessionIds: number[]) {
  const db = getDb();
  const overrides = sessionIds.length
    ? await db.reschedule.findMany({
        where: { sessionId: { in: sessionIds }, status: "APPROVED", appliedToMaster: false },
      })
    : [];
  return new Map(overrides.map((o) => [o.sessionId, o]));
}
