import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { teacherSchema } from "@/lib/validation/teacher";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const teachers = await db.teacher.findMany({ orderBy: { initials: "asc" } });
    return NextResponse.json({ ok: true, data: teachers });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load teachers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = teacherSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const db = getDb();
    const teacher = await db.teacher.create({ data: parsed.data });
    return NextResponse.json({ ok: true, data: teacher }, { status: 201 });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ ok: false, error: "Teacher initials already exist" }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to create teacher" }, { status: 500 });
  }
}
