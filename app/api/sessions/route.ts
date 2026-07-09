import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { z } from "zod";
import { createSessionSchema } from "@/lib/validation/session";

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
    const sessions = await db.session.findMany({
      include,
      orderBy: [{ day: "asc" }, { timeSlotId: "asc" }],
    });
    return NextResponse.json({ ok: true, data: sessions });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load sessions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const { day, timeSlotId, batchId, section, courseId, teacherId, roomId } = parsed.data;

    const db = getDb();
    const existing = await db.session.findMany({
      where: { day, timeSlotId },
      include: { room: true, teacher: true, batch: true },
    });

    const conflicts: string[] = [];

    if (existing.some((s) => s.roomId === roomId)) {
      const s = existing.find((s) => s.roomId === roomId)!;
      conflicts.push(`Room ${s.room.name} is already booked at this day & time.`);
    }

    if (existing.some((s) => s.teacherId === teacherId)) {
      const s = existing.find((s) => s.teacherId === teacherId)!;
      conflicts.push(`${s.teacher.initials} already has a class at this day & time.`);
    }

    // Batch conflict: same batch AND same section (or both null/empty)
    const normSection = section?.trim() || null;
    if (
      existing.some((s) => {
        if (s.batchId !== batchId) return false;
        const existSection = s.section?.trim() || null;
        // conflict if sections are the same (both null, or same string)
        return existSection === normSection;
      })
    ) {
      const s = existing.find((s) => s.batchId === batchId)!;
      conflicts.push(`Batch ${s.batch.name}${normSection ? ` (${normSection})` : ""} already has a class at this day & time.`);
    }

    if (conflicts.length > 0) {
      return NextResponse.json({ ok: false, error: conflicts.join(" ") }, { status: 409 });
    }

    const session = await db.session.create({
      data: { day, timeSlotId, batchId, section: normSection, courseId, teacherId, roomId },
      include,
    });

    return NextResponse.json({ ok: true, data: session }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to create session." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("id");
    const id = Number(raw);
    if (!raw || !Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    const db = getDb();
    await db.session.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to delete session" }, { status: 500 });
  }
}
