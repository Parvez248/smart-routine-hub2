import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAuthenticatedTeacher } from "@/lib/services/teacher-auth";

export async function GET() {
  const teacher = await getAuthenticatedTeacher();
  if (!teacher) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();

    const mySessions = await db.session.findMany({
      where: { teacherId: teacher.id },
      select: { id: true, section: true, course: true, batch: true },
    });
    const sessionIds = mySessions.map((s) => s.id);
    const sessionById = new Map(mySessions.map((s) => [s.id, s]));

    const [rooms, timeSlots, history] = await Promise.all([
      db.room.findMany(),
      db.timeSlot.findMany(),
      db.reschedule.findMany({
        where: { sessionId: { in: sessionIds } },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const slotById = new Map(timeSlots.map((t) => [t.id, t]));

    const data = history.map((h) => {
      const s = sessionById.get(h.sessionId);
      return {
        id: h.id,
        sessionId: h.sessionId,
        course: s?.course ?? null,
        batch: s?.batch ?? null,
        section: s?.section ?? null,
        oldDay: h.oldDay,
        oldTimeSlot: slotById.get(h.oldTimeSlotId) ?? null,
        oldRoom: roomById.get(h.oldRoomId) ?? null,
        newDay: h.newDay,
        newTimeSlot: slotById.get(h.newTimeSlotId) ?? null,
        newRoom: roomById.get(h.newRoomId) ?? null,
        reason: h.reason,
        createdAt: h.createdAt,
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load history" }, { status: 500 });
  }
}
