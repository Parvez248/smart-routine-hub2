import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { batchSchema } from "@/lib/validation/batch";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const batches = await db.batch.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ ok: true, data: batches });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load batches" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const db = getDb();
    const batch = await db.batch.create({ data: parsed.data });
    return NextResponse.json({ ok: true, data: batch }, { status: 201 });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ ok: false, error: "Batch name already exists" }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to create batch" }, { status: 500 });
  }
}
