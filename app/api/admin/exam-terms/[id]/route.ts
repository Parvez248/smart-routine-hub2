/**
 * One exam term, by id. Admin-only. PATCH renames it, edits its note, or
 * publishes/unpublishes it (409 on a duplicate name). DELETE removes the
 * term *and its exams* — the FK cascades — so it refuses (409) while the
 * term is still published: unpublish first, which makes deleting a live
 * exam routine a deliberate two-step action rather than one click.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { examTermUpdateSchema } from "@/lib/validation/exam";

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
    const parsed = examTermUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const { name, note, isPublished } = parsed.data;
    const db = getDb();
    const term = await db.examTerm.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(note !== undefined ? { note: note || null } : {}),
        ...(isPublished !== undefined ? { isPublished } : {}),
      },
    });
    return NextResponse.json({ ok: true, data: term });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ ok: false, error: "An exam term with this name already exists" }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to update exam term" }, { status: 500 });
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
    const term = await db.examTerm.findUnique({ where: { id } });
    if (!term) {
      return NextResponse.json({ ok: false, error: "Exam term not found" }, { status: 404 });
    }
    if (term.isPublished) {
      return NextResponse.json(
        { ok: false, error: "This exam term is published. Unpublish it before deleting." },
        { status: 409 }
      );
    }

    await db.examTerm.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to delete exam term" }, { status: 500 });
  }
}
