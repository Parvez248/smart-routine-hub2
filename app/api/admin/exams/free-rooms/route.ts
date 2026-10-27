/**
 * "Find free rooms" for the exam dialog. Admin-only. GET
 * `?date=&startTime=&endTime=` (all required, plus optional `excludeExamId`
 * when editing) — every room not already hosting an overlapping exam on
 * that date (see getFreeRoomsForExam in exams.ts). The class-routine
 * equivalent (../free-rooms) answers the day+TimeSlot question instead;
 * exams need a date and an arbitrary time span, so they're separate.
 *
 * Note this path wins over the sibling ../exams/[id] route: a static
 * segment always matches ahead of a dynamic one, so "free-rooms" is never
 * read as an exam id.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFreeRoomsForExam } from "@/lib/services/exams";
import { parseExamDate, timeToMinutes } from "@/lib/ui/examTime";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rawDate = searchParams.get("date");
  const startTime = searchParams.get("startTime");
  const endTime = searchParams.get("endTime");

  const date = rawDate ? parseExamDate(rawDate) : null;
  const start = startTime ? timeToMinutes(startTime) : null;
  const end = endTime ? timeToMinutes(endTime) : null;
  if (!date || start === null || end === null || end <= start) {
    return NextResponse.json({ ok: false, error: "Invalid date, startTime, or endTime" }, { status: 400 });
  }

  const rawExcludeId = searchParams.get("excludeExamId");
  const excludeExamId = rawExcludeId === null ? undefined : Number(rawExcludeId);
  if (excludeExamId !== undefined && (!Number.isInteger(excludeExamId) || excludeExamId <= 0)) {
    return NextResponse.json({ ok: false, error: "Invalid excludeExamId" }, { status: 400 });
  }

  try {
    const rooms = await getFreeRoomsForExam(date, startTime!, endTime!, excludeExamId);
    return NextResponse.json({ ok: true, data: rooms });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load free rooms" }, { status: 500 });
  }
}
