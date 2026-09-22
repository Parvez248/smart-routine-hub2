/**
 * Approve, reject, or revert one teacher reschedule request. Admin-only.
 * Body: `{ action: "approve" | "reject" | "revert", adminNote? }`
 * (reviewRescheduleSchema). This is the one route where scheduling.ts's
 * two effective-schedule flavours both matter in the same handler:
 *  - `isDated` (originalDate/newDate both set) — a one-occurrence move,
 *    checked with checkConflictForDate against what's actually taught that
 *    calendar date;
 *  - otherwise — a legacy/permanent weekly move, checked with checkConflict
 *    against the weekly pattern.
 *
 *  - "reject": only valid while PENDING (409 otherwise) — just marks it
 *    rejected, no schedule effect since it was never applied.
 *  - "approve": only valid while PENDING; re-checks conflict/capacity for
 *    the NEW slot right now — the slot may have been taken by something
 *    else since the teacher submitted the request — and refuses (409) if
 *    this session already has another active override for the same
 *    scope (dated: same date; permanent: any). A dated request whose date
 *    has already passed by approval time is also refused.
 *  - "revert": undoes an already-approved, still-active override by
 *    re-checking conflict for the ORIGINAL slot (something may have taken
 *    it back) and, if clear, marking the override CANCELLED — the
 *    session's own row is never touched; getEffectiveSessions(ForDate)
 *    simply stops seeing this override once it isn't APPROVED anymore.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { reviewRescheduleSchema } from "@/lib/validation/reschedule";
import { checkConflict, checkConflictForDate, checkCapacity } from "@/lib/services/scheduling";
import { isOnOrAfterToday } from "@/lib/services/dates";

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
    const isDated = request.originalDate !== null && request.newDate !== null;

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

      const conflict = isDated
        ? await checkConflictForDate({
            versionId: targetSession.versionId,
            date: request.originalDate!,
            timeSlotId: request.oldTimeSlotId,
            batchId: targetSession.batchId,
            section: targetSession.section,
            teacherId: targetSession.teacherId,
            roomId: request.oldRoomId,
            excludeSessionId: targetSession.id,
          })
        : await checkConflict({
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

    if (isDated && !isOnOrAfterToday(request.newDate!)) {
      return NextResponse.json({ ok: false, error: "This request's date has passed" }, { status: 409 });
    }

    const activeOverride = await db.reschedule.findFirst({
      where: {
        sessionId: request.sessionId,
        status: "APPROVED",
        appliedToMaster: false,
        originalDate: isDated ? request.originalDate : null,
      },
    });
    if (activeOverride) {
      return NextResponse.json(
        {
          ok: false,
          error: isDated
            ? "This class already has an active reschedule for that date. Revert it before approving a new one."
            : "This class already has an active reschedule override. Revert it before approving a new one.",
        },
        { status: 409 }
      );
    }

    const conflict = isDated
      ? await checkConflictForDate({
          versionId: targetSession.versionId,
          date: request.newDate!,
          timeSlotId: request.newTimeSlotId,
          batchId: targetSession.batchId,
          section: targetSession.section,
          teacherId: targetSession.teacherId,
          roomId: request.newRoomId,
          excludeSessionId: targetSession.id,
        })
      : await checkConflict({
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
