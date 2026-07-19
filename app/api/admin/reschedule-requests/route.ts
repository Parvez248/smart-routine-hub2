import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const requests = await db.reschedule.findMany({ orderBy: { createdAt: "desc" } });

    const sessionIds = [...new Set(requests.map((r) => r.sessionId))];
    const sessions = await db.session.findMany({
      where: { id: { in: sessionIds } },
      include: { course: true, teacher: true, batch: true },
    });
    const sessionById = new Map(sessions.map((s) => [s.id, s]));

    const [rooms, timeSlots] = await Promise.all([db.room.findMany(), db.timeSlot.findMany()]);
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const slotById = new Map(timeSlots.map((t) => [t.id, t]));

    const data = requests
      .map((r) => {
        const s = sessionById.get(r.sessionId);
        return {
          id: r.id,
          sessionId: r.sessionId,
          course: s?.course ?? null,
          teacher: s?.teacher ?? null,
          batch: s?.batch ?? null,
          section: s?.section ?? null,
          status: r.status,
          oldDay: r.oldDay,
          oldTimeSlot: slotById.get(r.oldTimeSlotId) ?? null,
          oldRoom: roomById.get(r.oldRoomId) ?? null,
          newDay: r.newDay,
          newTimeSlot: slotById.get(r.newTimeSlotId) ?? null,
          newRoom: roomById.get(r.newRoomId) ?? null,
          reason: r.reason,
          adminNote: r.adminNote,
          reviewedAt: r.reviewedAt,
          createdAt: r.createdAt,
        };
      })
      .sort((a, b) => {
        if (a.status === "PENDING" && b.status !== "PENDING") return -1;
        if (a.status !== "PENDING" && b.status === "PENDING") return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load reschedule requests" }, { status: 500 });
  }
}
