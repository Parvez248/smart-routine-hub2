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

export async function checkConflict(
  input: ConflictInput
): Promise<{ ok: boolean; reason?: string }> {
  const { day, timeSlotId, batchId, section, teacherId, roomId, versionId, excludeSessionId } = input;
  const db = getDb();

  const existing = await db.session.findMany({
    where: {
      day,
      timeSlotId,
      versionId,
      ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
    },
    include: { room: true, teacher: true, batch: true },
  });

  const conflicts: string[] = [];

  const roomConflict = existing.find((s) => s.roomId === roomId);
  if (roomConflict) {
    conflicts.push(`Room ${roomConflict.room.name} is already booked at this day & time.`);
  }

  const teacherConflict = existing.find((s) => s.teacherId === teacherId);
  if (teacherConflict) {
    conflicts.push(`${teacherConflict.teacher.initials} already has a class at this day & time.`);
  }

  const normSection = section?.trim() || null;
  const batchConflict = existing.find((s) => {
    if (s.batchId !== batchId) return false;
    const existSection = s.section?.trim() || null;
    return existSection === normSection;
  });
  if (batchConflict) {
    conflicts.push(
      `Batch ${batchConflict.batch.name}${normSection ? ` (${normSection})` : ""} already has a class at this day & time.`
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
  const [rooms, existing] = await Promise.all([
    db.room.findMany({ orderBy: { name: "asc" } }),
    db.session.findMany({ where: { day, timeSlotId, versionId }, select: { roomId: true } }),
  ]);

  const bookedRoomIds = new Set(existing.map((s) => s.roomId));
  return rooms.filter((r) => !bookedRoomIds.has(r.id));
}
