import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createSessionSchema } from "@/lib/validation/session";
import { checkConflict, checkCapacity } from "@/lib/services/scheduling";

const include = {
  course: true,
  teacher: true,
  room: true,
  batch: true,
  timeSlot: true,
} as const;

/**
 * PATCH — admin-only: full replace of one session's day/slot/batch/section/
 * course/teacher/room/version (same body shape and validation as POST
 * /api/sessions). Conflict/capacity are re-checked exactly as on create,
 * with `excludeSessionId: id` so the session being edited doesn't conflict
 * with its own current placement. 401 if not admin, 400 for a bad id or
 * failed validation or an unknown version, 409 for a conflict or capacity
 * failure, 500 on unexpected errors.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = createSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const { day, timeSlotId, batchId, section, courseId, teacherId, roomId, versionId } = parsed.data;
    const normSection = section?.trim() || null;

    const db = getDb();
    const version = await db.routineVersion.findUnique({ where: { id: versionId } });
    if (!version) {
      return NextResponse.json({ ok: false, error: "Invalid version" }, { status: 400 });
    }

    const conflict = await checkConflict({
      day,
      timeSlotId,
      batchId,
      section: normSection,
      teacherId,
      roomId,
      versionId,
      excludeSessionId: id,
    });
    if (!conflict.ok) {
      return NextResponse.json({ ok: false, error: conflict.reason }, { status: 409 });
    }

    const capacity = await checkCapacity(roomId, batchId);
    if (!capacity.ok) {
      return NextResponse.json({ ok: false, error: capacity.reason }, { status: 409 });
    }

    const updated = await db.session.update({
      where: { id },
      data: { day, timeSlotId, batchId, section: normSection, courseId, teacherId, roomId, versionId },
      include,
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to update session." }, { status: 500 });
  }
}
