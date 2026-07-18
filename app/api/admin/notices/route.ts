import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { noticeSchema } from "@/lib/validation/notice";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const notices = await db.notice.findMany({ orderBy: { createdAt: "desc" } });
    return NextResponse.json({ ok: true, data: notices });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load notices" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = noticeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const db = getDb();
    const notice = await db.notice.create({
      data: { ...parsed.data, postedById: Number(session.user.id) },
    });
    return NextResponse.json({ ok: true, data: notice }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to create notice" }, { status: 500 });
  }
}
