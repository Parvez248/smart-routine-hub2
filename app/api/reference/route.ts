/**
 * All reference data in one call — courses/teachers/rooms/batches/
 * timeSlots plus the fixed list of class days. Public (no auth() check):
 * used to populate the admin's session create/edit form and pickers
 * (SessionDialog, ScheduleSection), which are themselves behind proxy.ts's
 * /admin gate, but this endpoint itself doesn't re-check role — it's not
 * secret data (the same reference info is visible in the public routine).
 */
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const DAYS = ["Sat", "Sun", "Mon", "Tues", "Wed"];

export async function GET() {
  try {
    const db = getDb();
    const [courses, teachers, rooms, batches, timeSlots] = await Promise.all([
      db.course.findMany({ orderBy: { code: "asc" } }),
      db.teacher.findMany({ orderBy: { name: "asc" } }),
      db.room.findMany({ orderBy: { name: "asc" } }),
      db.batch.findMany({ orderBy: { name: "asc" } }),
      db.timeSlot.findMany({ orderBy: { sortOrder: "asc" } }),
    ]);
    return NextResponse.json({ ok: true, data: { courses, teachers, rooms, batches, timeSlots, days: DAYS } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load reference data" }, { status: 500 });
  }
}
