import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getAuthenticatedTeacher } from "@/lib/services/teacher-auth";
import { rescheduleSchema } from "@/lib/validation/reschedule";
import { checkConflict, checkCapacity } from "@/lib/services/scheduling";

const include = {
  course: true,
  teacher: true,
  room: true,
  batch: true,
  timeSlot: true,
} as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getAuthenticatedTeacher();
  if (!teacher) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = rescheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }
    const { newDay, newTimeSlotId, newRoomId, reason } = parsed.data;

    const db = getDb();
    const target = await db.session.findUnique({ where: { id } });
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

    const [, updated] = await db.$transaction([
      db.reschedule.create({
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
        },
      }),
      db.session.update({
        where: { id: target.id },
        data: { day: newDay, timeSlotId: newTimeSlotId, roomId: newRoomId },
        include,
      }),
    ]);

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to reschedule class" }, { status: 500 });
  }
}
