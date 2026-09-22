/**
 * "Find Free Rooms" (weekly view — admin Schedule tab and SessionDialog).
 * Admin-only. GET `?day=&timeSlotId=&versionId=`, all required — every room
 * not already booked at that day+slot in that version's effective weekly
 * schedule (see getFreeRooms in scheduling.ts). 400 if any param is
 * missing/invalid, 401 if not admin, 500 unexpected. The teacher-facing
 * equivalent (app/api/teacher/free-rooms) is date-based instead, for
 * reschedule requests — different question, different function.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFreeRooms } from "@/lib/services/scheduling";

const DAYS = ["Sat", "Sun", "Mon", "Tues", "Wed"];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const day = searchParams.get("day");
  const rawTimeSlotId = searchParams.get("timeSlotId");
  const timeSlotId = Number(rawTimeSlotId);
  const rawVersionId = searchParams.get("versionId");
  const versionId = Number(rawVersionId);

  if (
    !day || !DAYS.includes(day) ||
    !rawTimeSlotId || !Number.isInteger(timeSlotId) || timeSlotId <= 0 ||
    !rawVersionId || !Number.isInteger(versionId) || versionId <= 0
  ) {
    return NextResponse.json({ ok: false, error: "Invalid day, timeSlotId, or versionId" }, { status: 400 });
  }

  try {
    const rooms = await getFreeRooms(day, timeSlotId, versionId);
    return NextResponse.json({ ok: true, data: rooms });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load free rooms" }, { status: 500 });
  }
}
