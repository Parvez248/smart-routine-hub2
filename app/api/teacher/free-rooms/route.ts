import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAuthenticatedTeacher } from "@/lib/services/teacher-auth";
import { getFreeRoomsForDate } from "@/lib/services/scheduling";
import { parseDateOnly } from "@/lib/services/dates";

export async function GET(req: NextRequest) {
  const teacher = await getAuthenticatedTeacher();
  if (!teacher) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dateRaw = searchParams.get("date");
  const rawTimeSlotId = searchParams.get("timeSlotId");
  const timeSlotId = Number(rawTimeSlotId);

  const date = dateRaw ? parseDateOnly(dateRaw) : null;
  if (!date || !rawTimeSlotId || !Number.isInteger(timeSlotId) || timeSlotId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid date or timeSlotId" }, { status: 400 });
  }

  try {
    const db = getDb();
    const published = await db.routineVersion.findFirst({ where: { isPublished: true } });
    if (!published) {
      return NextResponse.json({ ok: true, data: [] });
    }
    const rooms = await getFreeRoomsForDate(published.id, date, timeSlotId);
    return NextResponse.json({ ok: true, data: rooms });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load free rooms" }, { status: 500 });
  }
}
