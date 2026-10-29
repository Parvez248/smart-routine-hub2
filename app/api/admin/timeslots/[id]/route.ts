/**
 * One time slot of the STANDARD period set, by id. Admin-only. PATCH
 * updates label/sortOrder; DELETE refuses (409) while any Session still
 * references this slot.
 *
 * Step 52 — a period that belongs to one routine version is not editable
 * here (404): this screen is the standard set, and a version's own periods
 * are edited in Routine → Versions → Periods & blocks, which validates the
 * whole set at once (one break, periods in order).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { timeSlotSchema } from "@/lib/validation/timeslot";

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
    const parsed = timeSlotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = await db.timeSlot.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Time slot not found" }, { status: 404 });
    }
    if (existing.versionId !== null) {
      return NextResponse.json(
        { ok: false, error: "That period belongs to a routine version. Edit it in Routine → Versions → Periods & blocks." },
        { status: 404 }
      );
    }

    const timeSlot = await db.timeSlot.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ ok: true, data: timeSlot });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to update time slot" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const db = getDb();
    const existing = await db.timeSlot.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Time slot not found" }, { status: 404 });
    }
    if (existing.versionId !== null) {
      return NextResponse.json(
        { ok: false, error: "That period belongs to a routine version. Edit it in Routine → Versions → Periods & blocks." },
        { status: 404 }
      );
    }

    const usageCount = await db.session.count({ where: { timeSlotId: id } });
    if (usageCount > 0) {
      return NextResponse.json(
        { ok: false, error: "Time slot is used in the routine and cannot be deleted" },
        { status: 409 }
      );
    }

    await db.timeSlot.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to delete time slot" }, { status: 500 });
  }
}
