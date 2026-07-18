import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { versionActionSchema } from "@/lib/validation/version";

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
    const parsed = versionActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const db = getDb();
    const [, version] = await db.$transaction([
      db.routineVersion.updateMany({ where: { id: { not: id } }, data: { isPublished: false } }),
      db.routineVersion.update({ where: { id }, data: { isPublished: true } }),
    ]);

    return NextResponse.json({ ok: true, data: version });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to publish version" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const db = getDb();
    const version = await db.routineVersion.findUnique({
      where: { id },
      include: { _count: { select: { sessions: true } } },
    });
    if (!version) {
      return NextResponse.json({ ok: false, error: "Version not found" }, { status: 404 });
    }
    if (version._count.sessions > 0) {
      return NextResponse.json(
        { ok: false, error: "Version has sessions and cannot be deleted" },
        { status: 409 }
      );
    }
    if (version.isPublished) {
      return NextResponse.json(
        { ok: false, error: "The published version cannot be deleted" },
        { status: 409 }
      );
    }

    await db.routineVersion.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to delete version" }, { status: 500 });
  }
}
