/**
 * Routine version CRUD (Admin → Routine → Versions). A `RoutineVersion` is
 * a named snapshot of the schedule (e.g. "Spring 2026") — sessions belong
 * to exactly one version, and only one version is ever `isPublished` at a
 * time (that's the one teacher/student/public views read). Admin-only.
 *   GET  — every version, newest first, each with its session count.
 *   POST — create a new (unpublished) version to start building a new
 *          routine without touching the currently-published one. 409 on
 *          a duplicate name.
 * PATCH/DELETE (including publish/unpublish) live in ./[id]/route.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { versionSchema } from "@/lib/validation/version";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const versions = await db.routineVersion.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { sessions: true } } },
    });
    const data = versions.map(({ _count, ...v }) => ({ ...v, sessionCount: _count.sessions }));
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load versions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = versionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const db = getDb();
    const version = await db.routineVersion.create({ data: parsed.data });
    return NextResponse.json({ ok: true, data: version }, { status: 201 });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ ok: false, error: "Version name already exists" }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to create version" }, { status: 500 });
  }
}
