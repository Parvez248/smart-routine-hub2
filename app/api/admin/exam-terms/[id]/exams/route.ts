/**
 * The exams inside one term. Admin-only.
 *
 * GET lists them in sitting order (date, then start time), optionally
 * narrowed by `?type=MIDTERM|FINAL` and `?batchId=` — the two filters the
 * builder's tabs and batch picker use.
 *
 * POST adds one. Every rule is checked by checkExamConflicts in
 * lib/services/exams.ts first (clashes, seating, section-vs-batch,
 * duplicates); `errors` there mean 409 and nothing is written, while
 * `warnings` are returned alongside the created exam so the builder can
 * show them without blocking the save.
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const termId = Number(rawId);
  if (!Number.isInteger(termId) || termId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  if (type !== null && type !== "MIDTERM" && type !== "FINAL") {
    return NextResponse.json({ ok: false, error: "Invalid type" }, { status: 400 });
  }
  const rawBatchId = searchParams.get("batchId");
  const batchId = rawBatchId === null ? null : Number(rawBatchId);
  if (batchId !== null && (!Number.isInteger(batchId) || batchId <= 0)) {
    return NextResponse.json({ ok: false, error: "Invalid batchId" }, { status: 400 });
  }

  try {
    const db = getDb();
    const term = await db.examTerm.findUnique({ where: { id: termId } });
    if (!term) {
      return NextResponse.json({ ok: false, error: "Exam term not found" }, { status: 404 });
    }

    const exams = await db.exam.findMany({
      where: { termId, ...(type ? { type } : {}), ...(batchId ? { batchId } : {}) },
      include: EXAM_INCLUDE,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json({ ok: true, data: { term, exams } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load exams" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const termId = Number(rawId);
  if (!Number.isInteger(termId) || termId <= 0) {
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
    const term = await db.examTerm.findUnique({ where: { id: termId } });
    if (!term) {
      return NextResponse.json({ ok: false, error: "Exam term not found" }, { status: 404 });
    }

    const date = parseExamDate(parsed.data.date);
    if (!date) {
      return NextResponse.json({ ok: false, error: "Invalid date" }, { status: 400 });
    }

    const section = parsed.data.section?.trim() || null;
    const check = await checkExamConflicts({
      termId,
      type: parsed.data.type,
      courseId: parsed.data.courseId,
      batchId: parsed.data.batchId,
      section,
      date,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      roomIds: parsed.data.roomIds,
    });
    if (!check.ok) {
      return NextResponse.json({ ok: false, error: check.errors.join(" "), errors: check.errors }, { status: 409 });
    }

    // The rooms are created with the exam, so a failure can't leave an exam
    // with no rooms behind (Prisma runs a nested create in one transaction).
    const exam = await db.exam.create({
      data: {
        termId,
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

    return NextResponse.json({ ok: true, data: exam, warnings: check.warnings }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to create exam" }, { status: 500 });
  }
}
