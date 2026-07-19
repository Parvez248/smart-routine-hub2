import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAuthenticatedTeacher } from "@/lib/services/teacher-auth";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getAuthenticatedTeacher();
  if (!teacher) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const db = getDb();
    const request = await db.reschedule.findUnique({ where: { id } });
    if (!request) {
      return NextResponse.json({ ok: false, error: "Request not found" }, { status: 404 });
    }
    if (request.changedById !== teacher.userId) {
      return NextResponse.json({ ok: false, error: "You can only cancel your own requests" }, { status: 403 });
    }
    if (request.status !== "PENDING") {
      return NextResponse.json({ ok: false, error: "Only pending requests can be cancelled" }, { status: 409 });
    }

    const updated = await db.reschedule.update({ where: { id }, data: { status: "CANCELLED" } });
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to cancel request" }, { status: 500 });
  }
}
