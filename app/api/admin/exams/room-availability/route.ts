/**
 * How full each room is in one sitting. Admin-only. GET
 * `?date=&sitting=` (both required, plus optional `excludeExamId` when
 * editing) returns every room with its capacity, the seats already taken in
 * that date+sitting, the seats left, and which batches are already there.
 *
 * This replaces Step 49's free-rooms endpoint: rooms are shared now, so the
 * question is no longer "which rooms are free" but "how much room is left in
 * each" (see getRoomAvailability in exams.ts).
 *
 * Note this path wins over the sibling ../exams/[id] route: a static segment
 * always matches ahead of a dynamic one, so "room-availability" is never
 * read as an exam id.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRoomAvailability } from "@/lib/services/exams";
import { parseExamDate } from "@/lib/ui/examTime";
import type { ExamSittingValue } from "@/lib/ui/examType";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = parseExamDate(searchParams.get("date") ?? "");
  const sitting = searchParams.get("sitting");
  if (!date || (sitting !== "MORNING" && sitting !== "AFTERNOON")) {
    return NextResponse.json({ ok: false, error: "Invalid date or sitting" }, { status: 400 });
  }

  const rawExcludeId = searchParams.get("excludeExamId");
  const excludeExamId = rawExcludeId === null ? undefined : Number(rawExcludeId);
  if (excludeExamId !== undefined && (!Number.isInteger(excludeExamId) || excludeExamId <= 0)) {
    return NextResponse.json({ ok: false, error: "Invalid excludeExamId" }, { status: 400 });
  }

  try {
    const rooms = await getRoomAvailability(date, sitting as ExamSittingValue, excludeExamId);
    return NextResponse.json({ ok: true, data: rooms });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load room availability" }, { status: 500 });
  }
}
