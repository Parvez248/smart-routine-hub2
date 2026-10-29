/**
 * The day structure of one routine version (Step 52): its period columns,
 * where the break falls, which periods a two-period lab may start at, and
 * its special blocks (Club Activities).
 *
 * `?versionId=` picks the version; without it, the published one — which is
 * what every teacher/student view wants. A version with no periods of its
 * own reports the standard set, so Spring 2026 answers exactly the six
 * periods it has always been drawn with.
 *
 * Public (no auth() check), for the same reason as GET /api/reference and
 * GET /api/sessions: these are the column headings of a routine that is
 * itself public. Read-only — this route never writes.
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getPeriodsForVersion, getSpecialBlocks } from "@/lib/services/periods";
import { breakAfterSortOrder, validLabStarts } from "@/lib/ui/periods";

export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const rawVersionId = searchParams.get("versionId");

    let versionId: number | null = null;
    let versionName: string | null = null;

    if (rawVersionId) {
      const parsed = Number(rawVersionId);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return NextResponse.json({ ok: false, error: "Invalid versionId" }, { status: 400 });
      }
      const version = await db.routineVersion.findUnique({ where: { id: parsed } });
      if (!version) {
        return NextResponse.json({ ok: false, error: "Version not found" }, { status: 404 });
      }
      versionId = version.id;
      versionName = version.name;
    } else {
      const published = await db.routineVersion.findFirst({ where: { isPublished: true } });
      versionId = published?.id ?? null;
      versionName = published?.name ?? null;
    }

    // With nothing published and no versionId given there is no version to
    // describe, but the standard periods still are the right answer — the
    // pickers that call this must not come back empty.
    const [periods, specialBlocks] = await Promise.all([
      getPeriodsForVersion(versionId),
      versionId === null ? Promise.resolve([]) : getSpecialBlocks(versionId),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        versionId,
        versionName,
        periods,
        specialBlocks,
        breakAfterSortOrder: breakAfterSortOrder(periods),
        validLabStarts: validLabStarts(periods),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load periods" }, { status: 500 });
  }
}
