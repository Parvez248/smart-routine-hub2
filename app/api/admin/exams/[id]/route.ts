/**
 * One exam, by id. Admin-only. PATCH edits it and DELETE removes it (its
 * ExamRoom rows cascade). PATCH runs the same checkExamConflicts the create
 * path runs — passing the exam's own id as `excludeExamId` so it doesn't
 * clash with itself — so the rules can't drift between adding and editing.
 *
 * The exam's term never changes here: moving an exam between terms isn't a
 * supported operation, so `termId` is read from the existing row.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { examSchema } from "@/lib/validation/exam";
import { checkExamConflicts } from "@/lib/services/exams";
import { parseExamDate } from "@/lib/ui/examTime";

const EXAM_INCLUDE = {
  course: true,
  batch: true,
  rooms: { include: { room: true }, orderBy: { room: { name: "asc" as const } } },
};

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
    const parsed = examSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = await db.exam.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Exam not found" }, { status: 404 });
    }

    const date = parseExamDate(parsed.data.date);
    if (!date) {
      return NextResponse.json({ ok: false, error: "Invalid date" }, { status: 400 });
    }

    const section = parsed.data.section?.trim() || null;
    const check = await checkExamConflicts({
      termId: existing.termId,
      type: parsed.data.type,
      courseId: parsed.data.courseId,
      batchId: parsed.data.batchId,
      section,
      date,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      roomIds: parsed.data.roomIds,
      excludeExamId: id,
    });
    if (!check.ok) {
      return NextResponse.json({ ok: false, error: check.errors.join(" "), errors: check.errors }, { status: 409 });
    }

    // Rooms are replaced wholesale rather than diffed — in one transaction, so
    // the exam is never briefly left with no rooms if the second step fails.
    const exam = await db.$transaction(async (tx) => {
      await tx.examRoom.deleteMany({ where: { examId: id } });
      return tx.exam.update({
        where: { id },
        data: {
          type: parsed.data.type,
          courseId: parsed.data.courseId,
          batchId: parsed.data.batchId,
          section,
          date,
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
          rooms: { create: parsed.data.roomIds.map((roomId) => ({ roomId })) },
        },
        include: EXAM_INCLUDE,
      });
    });

    return NextResponse.json({ ok: true, data: exam, warnings: check.warnings });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to update exam" }, { status: 500 });
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
    await db.exam.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
      return NextResponse.json({ ok: false, error: "Exam not found" }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to delete exam" }, { status: 500 });
  }
}
