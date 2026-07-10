import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { roomSchema } from "@/lib/validation/room";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const rooms = await db.room.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ ok: true, data: rooms });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load rooms" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = roomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const db = getDb();
    const room = await db.room.create({ data: parsed.data });
    return NextResponse.json({ ok: true, data: room }, { status: 201 });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ ok: false, error: "Room name already exists" }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to create room" }, { status: 500 });
  }
}
