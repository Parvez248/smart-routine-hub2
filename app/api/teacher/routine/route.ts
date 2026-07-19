import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAuthenticatedTeacher } from "@/lib/services/teacher-auth";

const DAY_ORDER = ["Sat", "Sun", "Mon", "Tues", "Wed"];

const include = {
  course: true,
  teacher: true,
  room: true,
  batch: true,
  timeSlot: true,
} as const;

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const batchIdRaw = searchParams.get("batchId");
    const day = searchParams.get("day");
    const roomIdRaw = searchParams.get("roomId");

    const where: { versionId: number; batchId?: number; day?: string; roomId?: number } = {
      versionId: published.id,
    };

    if (batchIdRaw) {
      const batchId = Number(batchIdRaw);
      if (!Number.isInteger(batchId) || batchId <= 0) {
        return NextResponse.json({ ok: false, error: "Invalid batchId" }, { status: 400 });
      }
      where.batchId = batchId;
    }
    if (day) {
      if (!DAY_ORDER.includes(day)) {
        return NextResponse.json({ ok: false, error: "Invalid day" }, { status: 400 });
      }
      where.day = day;
    }
    if (roomIdRaw) {
      const roomId = Number(roomIdRaw);
      if (!Number.isInteger(roomId) || roomId <= 0) {
        return NextResponse.json({ ok: false, error: "Invalid roomId" }, { status: 400 });
      }
      where.roomId = roomId;
    }

    const sessions = await db.session.findMany({ where, include });
    sessions.sort((a, b) => {
      const dayDiff = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return a.timeSlot.sortOrder - b.timeSlot.sortOrder;
    });

    return NextResponse.json({ ok: true, data: sessions });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load routine" }, { status: 500 });
  }
}
