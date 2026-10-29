/**
 * Time-slot reference-data CRUD (Academic Data → Time Slots — the day's
 * period columns, ordered by `sortOrder`, which is also what the break/lab
 * adjacency rules in labMerge.ts key off). Admin-only. GET lists all slots
 * in schedule order; POST creates one. PATCH/DELETE live in ./[id]/route.ts.
 * Unlike the other reference CRUD routes there's no unique-name conflict
 * handling here — sortOrder collisions aren't specially guarded against.
 */
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
    // Step 52 — this screen edits the STANDARD set (versionId = null),
    // which every version without periods of its own uses. A version’s own
    // periods are edited in Routine → Versions → Periods & blocks.
    const timeSlots = await db.timeSlot.findMany({
      where: { versionId: null },
      orderBy: { sortOrder: "asc" },
    });
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
