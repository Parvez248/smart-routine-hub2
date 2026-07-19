import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { reviewRescheduleSchema } from "@/lib/validation/reschedule";
import { checkConflict, checkCapacity } from "@/lib/services/scheduling";

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
    const parsed = reviewRescheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }
    const { action, adminNote } = parsed.data;

    const db = getDb();
    const request = await db.reschedule.findUnique({ where: { id } });
    if (!request) {
      return NextResponse.json({ ok: false, error: "Request not found" }, { status: 404 });
    }

    const adminUserId = Number(session.user.id);

    if (action === "reject") {
      if (request.status !== "PENDING") {
        return NextResponse.json({ ok: false, error: "This request has already been decided" }, { status: 409 });
      }
      const updated = await db.reschedule.update({
        where: { id },
        data: {
          status: "REJECTED",
          reviewedById: adminUserId,
          reviewedAt: new Date(),
          adminNote: adminNote ?? null,
        },
      });
      return NextResponse.json({ ok: true, data: updated });
    }

    const targetSession = await db.session.findUnique({ where: { id: request.sessionId } });
    if (!targetSession) {
      return NextResponse.json({ ok: false, error: "The original class no longer exists" }, { status: 404 });
    }
    if (!targetSession.versionId) {
      return NextResponse.json({ ok: false, error: "This class has no routine version" }, { status: 400 });
    }

    if (action === "revert") {
      if (request.status !== "APPROVED" || request.appliedToMaster) {
        return NextResponse.json({ ok: false, error: "This request is not an active override" }, { status: 409 });
      }

      const conflict = await checkConflict({
        day: targetSession.day,
        timeSlotId: targetSession.timeSlotId,
        batchId: targetSession.batchId,
        section: targetSession.section,
        teacherId: targetSession.teacherId,
        roomId: targetSession.roomId,
        versionId: targetSession.versionId,
        excludeSessionId: targetSession.id,
      });
      if (!conflict.ok) {
        return NextResponse.json(
          { ok: false, error: `Cannot revert: the original slot is now occupied. ${conflict.reason ?? ""}`.trim() },
          { status: 409 }
        );
      }

      const updated = await db.reschedule.update({ where: { id }, data: { status: "CANCELLED" } });
      return NextResponse.json({ ok: true, data: updated });
    }

    // action === "approve"
    if (request.status !== "PENDING") {
      return NextResponse.json({ ok: false, error: "This request has already been decided" }, { status: 409 });
    }

    const activeOverride = await db.reschedule.findFirst({
      where: { sessionId: request.sessionId, status: "APPROVED", appliedToMaster: false },
    });
    if (activeOverride) {
      return NextResponse.json(
        { ok: false, error: "This class already has an active reschedule override. Revert it before approving a new one." },
        { status: 409 }
      );
    }

    const conflict = await checkConflict({
      day: request.newDay,
      timeSlotId: request.newTimeSlotId,
      batchId: targetSession.batchId,
      section: targetSession.section,
      teacherId: targetSession.teacherId,
      roomId: request.newRoomId,
      versionId: targetSession.versionId,
      excludeSessionId: targetSession.id,
    });
    if (!conflict.ok) {
      return NextResponse.json({ ok: false, error: conflict.reason }, { status: 409 });
    }

    const capacity = await checkCapacity(request.newRoomId, targetSession.batchId);
    if (!capacity.ok) {
      return NextResponse.json({ ok: false, error: capacity.reason }, { status: 409 });
    }

    const updated = await db.reschedule.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedById: adminUserId,
        reviewedAt: new Date(),
        adminNote: adminNote ?? null,
        appliedToMaster: false,
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to update request" }, { status: 500 });
  }
}
