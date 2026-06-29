import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

const include = {
  course: true,
  teacher: true,
  room: true,
  batch: true,
  timeSlot: true,
} as const;

export async function GET() {
  try {
    const db = getDb();
    const sessions = await db.session.findMany({ include, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ ok: true, data: sessions });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load sessions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { day, timeSlotId, batchId, section, courseId, teacherId, roomId } = body;

    if (!day || !timeSlotId || !batchId || !courseId || !teacherId || !roomId) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    const db = getDb();
    const session = await db.session.create({
      data: {
        day,
        timeSlotId: Number(timeSlotId),
        batchId: Number(batchId),
        section: section || null,
        courseId: Number(courseId),
        teacherId: Number(teacherId),
        roomId: Number(roomId),
      },
      include,
    });

    return NextResponse.json({ ok: true, data: session }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to create session" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

    const db = getDb();
    await db.session.delete({ where: { id: Number(id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to delete session" }, { status: 500 });
  }
}
