import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const requests = await db.user.findMany({
      where: { role: "TEACHER", status: "PENDING", emailVerified: true },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Teachers self-register with a Teacher row created under the same name;
    // there is no FK, so match by name to surface initials in the review list.
    const teachers = await db.teacher.findMany({
      where: { name: { in: requests.map((r) => r.name).filter((n): n is string => !!n) } },
      select: { name: true, initials: true },
    });
    const initialsByName = new Map(teachers.map((t) => [t.name, t.initials]));

    const data = requests.map((r) => ({
      ...r,
      initials: (r.name && initialsByName.get(r.name)) ?? null,
    }));

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load teacher requests" }, { status: 500 });
  }
}
