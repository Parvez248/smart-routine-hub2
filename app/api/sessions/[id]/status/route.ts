import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "CANCELLED"]),
});

const include = {
  course: true,
  teacher: true,
  room: true,
  batch: true,
  timeSlot: true,
} as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const db = getDb();
    const updated = await db.session.update({
      where: { id },
      data: { status: parsed.data.status },
      include,
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to update session status" }, { status: 500 });
  }
}
