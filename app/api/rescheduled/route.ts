import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const published = await db.routineVersion.findFirst({ where: { isPublished: true } });
    if (!published) {
      return NextResponse.json({ ok: true, data: [] });
    }

    const sessions = await db.session.findMany({
      where: { versionId: published.id, status: "ACTIVE" },
      include: { course: true, teacher: true, batch: true },
    });
    const sessionIds = sessions.map((s) => s.id);
    const sessionById = new Map(sessions.map((s) => [s.id, s]));

    const overrides = sessionIds.length
      ? await db.reschedule.findMany({
          where: { sessionId: { in: sessionIds }, status: "APPROVED", appliedToMaster: false },
        })
      : [];

    const [rooms, timeSlots] = await Promise.all([db.room.findMany(), db.timeSlot.findMany()]);
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const slotById = new Map(timeSlots.map((t) => [t.id, t]));

    const data = overrides.flatMap((o) => {
      const s = sessionById.get(o.sessionId);
      if (!s) return [];
      return [
        {
          id: o.id,
          sessionId: s.id,
          course: s.course,
          teacher: s.teacher,
          batch: s.batch,
          section: s.section,
          kind: o.originalDate ? "dated" : "legacy",
          originalDate: o.originalDate,
          newDate: o.newDate,
          fromDay: o.oldDay,
          fromTimeSlot: slotById.get(o.oldTimeSlotId) ?? null,
          fromRoom: roomById.get(o.oldRoomId) ?? null,
          toDay: o.newDay,
          toTimeSlot: slotById.get(o.newTimeSlotId) ?? null,
          toRoom: roomById.get(o.newRoomId) ?? null,
          reason: o.reason,
          adminNote: o.adminNote,
          reviewedAt: o.reviewedAt,
        },
      ];
    });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load rescheduled classes" }, { status: 500 });
  }
}
