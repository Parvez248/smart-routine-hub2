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
