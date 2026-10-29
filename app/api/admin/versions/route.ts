/**
 * Routine version CRUD (Admin → Routine → Versions). A `RoutineVersion` is
 * a named snapshot of the schedule (e.g. "Spring 2026") — sessions belong
 * to exactly one version, and only one version is ever `isPublished` at a
 * time (that's the one teacher/student/public views read). Admin-only.
 *   GET  — every version, newest first, each with its session count.
 *   POST — create a new (unpublished) version to start building a new
 *          routine without touching the currently-published one. 409 on
 *          a duplicate name. `copyPeriodsFromVersionId` (Step 52) gives it
 *          its own copy of another version's periods and special blocks.
 * PATCH/DELETE (including publish/unpublish) live in ./[id]/route.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { versionSchema } from "@/lib/validation/version";
import { getPeriodsForVersion, getSpecialBlocks } from "@/lib/services/periods";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getDb();
    const versions = await db.routineVersion.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { sessions: true } } },
    });
    const data = versions.map(({ _count, ...v }) => ({ ...v, sessionCount: _count.sessions }));
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load versions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = versionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const db = getDb();
    const { copyPeriodsFromVersionId, ...versionData } = parsed.data;

    // Step 52 — "Copy from version…": the new version gets its *own*
    // copy of the source's periods and special blocks, never a reference to
    // them, so editing one routine's day structure can't change another's.
    // The source's effective set is copied (its own periods if it has any,
    // else the standard set), which is what the admin sees on screen.
    let source: { periods: Awaited<ReturnType<typeof getPeriodsForVersion>>; blocks: Awaited<ReturnType<typeof getSpecialBlocks>> } | null = null;
    if (copyPeriodsFromVersionId) {
      const sourceVersion = await db.routineVersion.findUnique({ where: { id: copyPeriodsFromVersionId } });
      if (!sourceVersion) {
        return NextResponse.json({ ok: false, error: "The version to copy periods from no longer exists" }, { status: 400 });
      }
      source = {
        periods: await getPeriodsForVersion(copyPeriodsFromVersionId),
        blocks: await getSpecialBlocks(copyPeriodsFromVersionId),
      };
    }

    const version = await db.routineVersion.create({ data: versionData });

    if (source) {
      await db.$transaction([
        ...source.periods.map((p) =>
          db.timeSlot.create({
            data: {
              versionId: version.id,
              label: p.label,
              sortOrder: p.sortOrder,
              startTime: p.startTime,
              endTime: p.endTime,
              breakAfter: p.breakAfter,
            },
          })
        ),
        ...source.blocks.map((b) =>
          db.specialBlock.create({
            data: {
              versionId: version.id,
              day: b.day,
              fromSlot: b.fromSlot,
              toSlot: b.toSlot,
              label: b.label,
              subLabel: b.subLabel,
              allBatches: b.allBatches,
              batches: b.allBatches ? undefined : { create: b.batchIds.map((batchId) => ({ batchId })) },
            },
          })
        ),
      ]);
    }

    return NextResponse.json({ ok: true, data: version }, { status: 201 });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ ok: false, error: "Version name already exists" }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to create version" }, { status: 500 });
  }
}
