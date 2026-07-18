import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getAuthenticatedStudent } from "@/lib/services/student-auth";
import { createAlarmSchema } from "@/lib/validation/alarm";

const DAY_ORDER = ["Sat", "Sun", "Mon", "Tues", "Wed"];

const sessionInclude = {
  course: true,
  teacher: true,
  room: true,
  batch: true,
  timeSlot: true,
} as const;

export async function GET() {
  const student = await getAuthenticatedStudent();
  if (!student) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const alarms = await db.alarm.findMany({ where: { studentId: student.id } });
    const sessions = await db.session.findMany({
      where: { id: { in: alarms.map((a) => a.sessionId) } },
      include: sessionInclude,
    });
    const sessionById = new Map(sessions.map((s) => [s.id, s]));

    const data = alarms
      .map((a) => ({ ...a, session: sessionById.get(a.sessionId) ?? null }))
      .filter((a) => a.session !== null)
      .sort((a, b) => {
        const dayDiff = DAY_ORDER.indexOf(a.session!.day) - DAY_ORDER.indexOf(b.session!.day);
        if (dayDiff !== 0) return dayDiff;
        return a.session!.timeSlot.sortOrder - b.session!.timeSlot.sortOrder;
      });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load reminders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const student = await getAuthenticatedStudent();
  if (!student) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = createAlarmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }
    const { sessionId, leadMinutes } = parsed.data;

    const db = getDb();
    const [published, targetSession] = await Promise.all([
      db.routineVersion.findFirst({ where: { isPublished: true } }),
      db.session.findUnique({ where: { id: sessionId } }),
    ]);

    if (
      !targetSession ||
      !published ||
      targetSession.versionId !== published.id ||
      targetSession.batchId !== student.batchId
    ) {
      return NextResponse.json(
        { ok: false, error: "You can only set reminders for your own batch's published classes" },
        { status: 403 }
      );
    }

    const existing = await db.alarm.findUnique({
      where: { studentId_sessionId: { studentId: student.id, sessionId } },
    });
    if (existing) {
      return NextResponse.json({ ok: false, error: "A reminder already exists for this class" }, { status: 409 });
    }

    const alarm = await db.alarm.create({ data: { studentId: student.id, sessionId, leadMinutes } });
    return NextResponse.json({ ok: true, data: alarm }, { status: 201 });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ ok: false, error: "A reminder already exists for this class" }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to create reminder" }, { status: 500 });
  }
}
