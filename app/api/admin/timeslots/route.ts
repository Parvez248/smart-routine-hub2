import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { timeSlotSchema } from "@/lib/validation/timeslot";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const timeSlots = await db.timeSlot.findMany({ orderBy: { sortOrder: "asc" } });
    return NextResponse.json({ ok: true, data: timeSlots });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load time slots" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = timeSlotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const db = getDb();
    const timeSlot = await db.timeSlot.create({ data: parsed.data });
    return NextResponse.json({ ok: true, data: timeSlot }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to create time slot" }, { status: 500 });
  }
}
