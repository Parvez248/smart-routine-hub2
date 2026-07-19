import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getAuthenticatedTeacher } from "@/lib/services/teacher-auth";
import { rescheduleRequestSchema } from "@/lib/validation/reschedule";
import { checkConflict, checkCapacity } from "@/lib/services/scheduling";

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

    const [rooms, timeSlots, requests] = await Promise.all([
      db.room.findMany(),
      db.timeSlot.findMany(),
      db.reschedule.findMany({
        where: { sessionId: { in: sessionIds } },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const roomById = new Map(rooms.map((r) => [r.id, r]));
    const slotById = new Map(timeSlots.map((t) => [t.id, t]));

    const data = requests.map((r) => {
      const s = sessionById.get(r.sessionId);
      return {
        id: r.id,
        sessionId: r.sessionId,
        course: s?.course ?? null,
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
    });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load requests" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const teacher = await getAuthenticatedTeacher();
  if (!teacher) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = rescheduleRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }
    const { sessionId, newDay, newTimeSlotId, newRoomId, reason } = parsed.data;

    const db = getDb();
    const target = await db.session.findUnique({ where: { id: sessionId } });
    if (!target) {
      return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
    }
    if (target.teacherId !== teacher.id) {
      return NextResponse.json(
        { ok: false, error: "You can only reschedule your own classes" },
        { status: 403 }
      );
    }
    if (!target.versionId) {
      return NextResponse.json({ ok: false, error: "This class has no routine version" }, { status: 400 });
    }

    const existingPending = await db.reschedule.findFirst({
      where: { sessionId: target.id, status: "PENDING" },
    });
    if (existingPending) {
      return NextResponse.json(
        { ok: false, error: "A request for this class is already awaiting approval" },
        { status: 409 }
      );
    }

    const conflict = await checkConflict({
      day: newDay,
      timeSlotId: newTimeSlotId,
      batchId: target.batchId,
      section: target.section,
      teacherId: target.teacherId,
      roomId: newRoomId,
      versionId: target.versionId,
      excludeSessionId: target.id,
    });
    if (!conflict.ok) {
      return NextResponse.json({ ok: false, error: conflict.reason }, { status: 409 });
    }

    const capacity = await checkCapacity(newRoomId, target.batchId);
    if (!capacity.ok) {
      return NextResponse.json({ ok: false, error: capacity.reason }, { status: 409 });
    }

    const created = await db.reschedule.create({
      data: {
        sessionId: target.id,
        changedById: teacher.userId,
        oldDay: target.day,
        oldTimeSlotId: target.timeSlotId,
        oldRoomId: target.roomId,
        newDay,
        newTimeSlotId,
        newRoomId,
        reason: reason ?? null,
        status: "PENDING",
      },
    });

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to submit reschedule request" }, { status: 500 });
  }
}
