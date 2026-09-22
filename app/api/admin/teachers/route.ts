/**
 * Teacher reference-data CRUD (Academic Data → Teachers). Admin-only.
 *   GET  — every teacher, each with its login email if one exists
 *          (`Teacher.userId` links to a `User`; a teacher can exist purely
 *          as a routine-scheduling entity with no login at all, e.g. right
 *          after being imported — see lib/services/teacherAccounts.ts for
 *          how a login gets created for one).
 *   POST — create a teacher record (initials/name only — no login; use
 *          ./[id]/create-login to add one). 409 if the initials already exist.
 * PATCH/DELETE and the login-management actions live under ./[id]/.
 */
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
    const userIds = teachers.map((t) => t.userId).filter((id): id is number => id !== null);
    const users = userIds.length
      ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } })
      : [];
    const emailById = new Map(users.map((u) => [u.id, u.email]));
    const data = teachers.map((t) => ({ ...t, email: t.userId ? emailById.get(t.userId) ?? null : null }));
    return NextResponse.json({ ok: true, data });
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
