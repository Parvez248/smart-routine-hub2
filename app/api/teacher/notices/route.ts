import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getAuthenticatedTeacher } from "@/lib/services/teacher-auth";

export async function GET() {
  const teacher = await getAuthenticatedTeacher();
  if (!teacher) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const notices = await db.notice.findMany({
      where: { audience: { in: ["ALL", "TEACHERS"] } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ ok: true, data: notices });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load notices" }, { status: 500 });
  }
}
