import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    const batches = await db.batch.findMany({
      select: { id: true, name: true, semester: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ ok: true, data: batches });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load batches" }, { status: 500 });
  }
}
