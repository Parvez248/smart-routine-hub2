/**
 * Exam terms (admin → Exams). Admin-only. GET lists every term, newest
 * first, with its exam count; POST creates one. A new term always starts
 * unpublished — publishing is a separate PATCH, so a half-built exam
 * routine is never visible to students (Step 51 will read `isPublished`).
 * PATCH/DELETE live in ./[id]/route.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { examTermSchema } from "@/lib/validation/exam";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const terms = await db.examTerm.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { exams: true } } },
    });
    return NextResponse.json({ ok: true, data: terms });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load exam terms" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = examTermSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const db = getDb();
    const term = await db.examTerm.create({
      data: { name: parsed.data.name, note: parsed.data.note || null },
    });
    return NextResponse.json({ ok: true, data: term }, { status: 201 });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ ok: false, error: "An exam term with this name already exists" }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to create exam term" }, { status: 500 });
  }
}
