import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAuthenticatedStudent } from "@/lib/services/student-auth";

const DAY_ORDER = ["Sat", "Sun", "Mon", "Tues", "Wed"];

const include = {
  course: true,
  teacher: true,
  room: true,
  batch: true,
  timeSlot: true,
} as const;

export async function GET(req: NextRequest) {
  const student = await getAuthenticatedStudent();
  if (!student) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const rawBatchId = searchParams.get("batchId");

    let batchId = student.batchId;
    if (rawBatchId) {
      const parsedBatchId = Number(rawBatchId);
      if (!Number.isInteger(parsedBatchId) || parsedBatchId <= 0) {
        return NextResponse.json({ ok: false, error: "Invalid batchId" }, { status: 400 });
      }
      batchId = parsedBatchId;
    }

    const published = await db.routineVersion.findFirst({ where: { isPublished: true } });
    if (!published) {
      return NextResponse.json({
        ok: true,
        data: { sessions: [], versionName: null, message: "No routine has been published yet.", batchId },
      });
    }

    const sessions = await db.session.findMany({
      where: { versionId: published.id, batchId },
      include,
    });

    sessions.sort((a, b) => {
      const dayDiff = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return a.timeSlot.sortOrder - b.timeSlot.sortOrder;
    });

    return NextResponse.json({
      ok: true,
      data: { sessions, versionName: published.name, message: null, batchId },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load routine" }, { status: 500 });
  }
}
