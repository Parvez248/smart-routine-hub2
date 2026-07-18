import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createSessionSchema } from "@/lib/validation/session";
import { checkConflict, checkCapacity } from "@/lib/services/scheduling";

const include = {
  course: true,
  teacher: true,
  room: true,
  batch: true,
  timeSlot: true,
} as const;

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const rawVersionId = searchParams.get("versionId");

    let versionId: number | null = rawVersionId ? Number(rawVersionId) : null;
    if (versionId !== null && (!Number.isInteger(versionId) || versionId <= 0)) {
      return NextResponse.json({ ok: false, error: "Invalid versionId" }, { status: 400 });
    }

    if (versionId === null) {
      const published = await db.routineVersion.findFirst({ where: { isPublished: true } });
      versionId = published?.id ?? null;
    }

    if (versionId === null) {
      return NextResponse.json({ ok: true, data: [] });
    }

    const sessions = await db.session.findMany({
      where: { versionId },
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
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const { day, timeSlotId, batchId, section, courseId, teacherId, roomId, versionId } = parsed.data;
    const normSection = section?.trim() || null;

    const db = getDb();
    const version = await db.routineVersion.findUnique({ where: { id: versionId } });
    if (!version) {
      return NextResponse.json({ ok: false, error: "Invalid version" }, { status: 400 });
    }

    const conflict = await checkConflict({ day, timeSlotId, batchId, section: normSection, teacherId, roomId, versionId });
    if (!conflict.ok) {
      return NextResponse.json({ ok: false, error: conflict.reason }, { status: 409 });
    }

    const capacity = await checkCapacity(roomId, batchId);
    if (!capacity.ok) {
      return NextResponse.json({ ok: false, error: capacity.reason }, { status: 409 });
    }

    const created = await db.session.create({
      data: { day, timeSlotId, batchId, section: normSection, courseId, teacherId, roomId, versionId },
      include,
    });

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
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
