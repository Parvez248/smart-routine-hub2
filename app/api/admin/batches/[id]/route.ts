/**
 * One batch, by id. Admin-only. PATCH updates name/semester/studentCount/
 * sectionCount (409 on duplicate name); DELETE refuses (409) while any
 * Session still references this batch.
 *
 * Turning sections OFF (2 → 1) is refused with a 409 while any session of
 * this batch — in ANY version, not just the published one — still carries a
 * section, since those classes would otherwise be left with a section value
 * the batch no longer allows (Step 50 §4). Turning them ON (1 → 2) is
 * always safe and allowed.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { batchSchema } from "@/lib/validation/batch";

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
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const db = getDb();

    if (parsed.data.sectionCount === 1) {
      const existing = await db.batch.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ ok: false, error: "Batch not found" }, { status: 404 });
      }
      if (existing.sectionCount === 2) {
        const sectionedCount = await db.session.count({
          where: { batchId: id, section: { not: null } },
        });
        if (sectionedCount > 0) {
          return NextResponse.json(
            {
              ok: false,
              error:
                sectionedCount === 1
                  ? "1 class of this batch uses sections; change it first."
                  : `${sectionedCount} classes of this batch use sections; change them first.`,
            },
            { status: 409 }
          );
        }
      }
    }

    const batch = await db.batch.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ ok: true, data: batch });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ ok: false, error: "Batch name already exists" }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to update batch" }, { status: 500 });
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
    const usageCount = await db.session.count({ where: { batchId: id } });
    if (usageCount > 0) {
      return NextResponse.json(
        { ok: false, error: "Batch is used in the routine and cannot be deleted" },
        { status: 409 }
      );
    }

    await db.batch.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to delete batch" }, { status: 500 });
  }
}
