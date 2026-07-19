import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { checkConflict, checkCapacity } from "@/lib/services/scheduling";

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "CANCELLED"]),
});

const include = {
  course: true,
  teacher: true,
  room: true,
  batch: true,
  timeSlot: true,
} as const;

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
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const db = getDb();

    if (parsed.data.status === "ACTIVE") {
      const target = await db.session.findUnique({ where: { id } });
      if (!target) {
        return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });
      }
      if (!target.versionId) {
        return NextResponse.json({ ok: false, error: "This class has no routine version" }, { status: 400 });
      }

      const conflict = await checkConflict({
        day: target.day,
        timeSlotId: target.timeSlotId,
        batchId: target.batchId,
        section: target.section,
        teacherId: target.teacherId,
        roomId: target.roomId,
        versionId: target.versionId,
        excludeSessionId: target.id,
      });
      if (!conflict.ok) {
        return NextResponse.json(
          { ok: false, error: `Cannot restore: the room is now used by another class in this time slot. ${conflict.reason ?? ""}`.trim() },
          { status: 409 }
        );
      }

      const capacity = await checkCapacity(target.roomId, target.batchId);
      if (!capacity.ok) {
        return NextResponse.json({ ok: false, error: capacity.reason }, { status: 409 });
      }
    }

    const updated = await db.session.update({
      where: { id },
      data: { status: parsed.data.status },
      include,
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to update session status" }, { status: 500 });
  }
}
