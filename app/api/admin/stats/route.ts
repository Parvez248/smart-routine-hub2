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
    const publishedVersion = await db.routineVersion.findFirst({ where: { isPublished: true } });

    const [
      courseCount,
      teacherCount,
      roomCount,
      batchCount,
      timeSlotCount,
      publishedSessionCount,
      cancelledSessionCount,
      pendingTeacherRequestCount,
    ] = await Promise.all([
      db.course.count(),
      db.teacher.count(),
      db.room.count(),
      db.batch.count(),
      db.timeSlot.count(),
      publishedVersion ? db.session.count({ where: { versionId: publishedVersion.id } }) : Promise.resolve(0),
      publishedVersion
        ? db.session.count({ where: { versionId: publishedVersion.id, status: "CANCELLED" } })
        : Promise.resolve(0),
      db.user.count({ where: { role: "TEACHER", status: "PENDING", emailVerified: true } }),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        courseCount,
        teacherCount,
        roomCount,
        batchCount,
        timeSlotCount,
        publishedSessionCount,
        cancelledSessionCount,
        pendingTeacherRequestCount,
        publishedVersionName: publishedVersion?.name ?? null,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load stats" }, { status: 500 });
  }
}
