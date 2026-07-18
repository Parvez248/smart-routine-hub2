import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getAuthenticatedStudent } from "@/lib/services/student-auth";
import { updateAlarmSchema } from "@/lib/validation/alarm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const student = await getAuthenticatedStudent();
  if (!student) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = updateAlarmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const db = getDb();
    const alarm = await db.alarm.findUnique({ where: { id } });
    if (!alarm) {
      return NextResponse.json({ ok: false, error: "Reminder not found" }, { status: 404 });
    }
    if (alarm.studentId !== student.id) {
      return NextResponse.json({ ok: false, error: "You can only manage your own reminders" }, { status: 403 });
    }

    const updated = await db.alarm.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to update reminder" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const student = await getAuthenticatedStudent();
  if (!student) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const db = getDb();
    const alarm = await db.alarm.findUnique({ where: { id } });
    if (!alarm) {
      return NextResponse.json({ ok: false, error: "Reminder not found" }, { status: 404 });
    }
    if (alarm.studentId !== student.id) {
      return NextResponse.json({ ok: false, error: "You can only manage your own reminders" }, { status: 403 });
    }

    await db.alarm.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to delete reminder" }, { status: 500 });
  }
}
