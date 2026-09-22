/**
 * A teacher's own classes — every session in the published version where
 * `teacherId` matches the signed-in teacher, day/slot ordered. Teacher-only
 * (getAuthenticatedTeacher — see lib/services/teacher-auth.ts). This is
 * the underlying data for both "My Classes" and (Step 43) "My Courses",
 * which derives its distinct-course cards from this same list client-side
 * rather than needing its own endpoint.
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAuthenticatedTeacher } from "@/lib/services/teacher-auth";

const include = {
  course: true,
  teacher: true,
  room: true,
  batch: true,
  timeSlot: true,
} as const;

export async function GET() {
  const teacher = await getAuthenticatedTeacher();
  if (!teacher) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const published = await db.routineVersion.findFirst({ where: { isPublished: true } });
    if (!published) {
      return NextResponse.json({ ok: true, data: [] });
    }

    const sessions = await db.session.findMany({
      where: { teacherId: teacher.id, versionId: published.id },
      include,
      orderBy: [{ day: "asc" }, { timeSlotId: "asc" }],
    });
    return NextResponse.json({ ok: true, data: sessions });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load classes" }, { status: 500 });
  }
}
