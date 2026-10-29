/**
 * One routine version's own period set (Step 52). Admin-only.
 *   GET — the periods this version schedules against, each with how many
 *         classes use it, plus `isOwn: false` when these are the shared
 *         standard periods rather than the version's own.
 *   PUT — replace this version's own periods with the submitted set.
 *
 * PUT is a whole-set replace rather than per-period CRUD because the rules
 * that matter are rules *about the set* — at most one break, periods in
 * time order — and they can only be checked when the whole set is in hand.
 *
 * What it refuses (409, never a 500 or a silent data loss):
 *  - removing a period that still has classes, or renumbering one;
 *  - editing the standard set through here. The standard set is shared by
 *    every version that has no periods of its own, so changing it would
 *    change those routines too; it is edited in Academic Data -> Time
 *    Slots, deliberately not here.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getPeriodsForVersion, getPeriodUsage, hasOwnPeriods } from "@/lib/services/periods";
import { periodSetSchema } from "@/lib/validation/periods";
import { periodSetErrors } from "@/lib/ui/periods";

async function requireAdmin() {
  const session = await auth();
  return session?.user?.role === "ADMIN";
}

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const db = getDb();
    const version = await db.routineVersion.findUnique({ where: { id } });
    if (!version) {
      return NextResponse.json({ ok: false, error: "Version not found" }, { status: 404 });
    }

    const [periods, isOwn] = await Promise.all([getPeriodsForVersion(id), hasOwnPeriods(id)]);
    const usage = await getPeriodUsage(periods.map((p) => p.id));

    return NextResponse.json({
      ok: true,
      data: {
        isOwn,
        periods: periods.map((p) => ({ ...p, sessionCount: usage.get(p.id) ?? 0 })),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load periods" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = periodSetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const db = getDb();
    const version = await db.routineVersion.findUnique({ where: { id } });
    if (!version) {
      return NextResponse.json({ ok: false, error: "Version not found" }, { status: 404 });
    }

    const submitted = parsed.data.periods.map((p) => ({
      ...p,
      startTime: p.startTime ?? null,
      endTime: p.endTime ?? null,
    }));

    const setErrors = periodSetErrors(submitted);
    if (setErrors.length > 0) {
      return NextResponse.json({ ok: false, error: setErrors.join(" ") }, { status: 400 });
    }

    const existing = await db.timeSlot.findMany({ where: { versionId: id } });

    // Editing the standard set is not allowed here — see the file comment.
    // A version with no periods of its own is *adopting* a set, which is
    // allowed; what is refused is reaching the shared rows through it.
    const submittedIds = submitted.map((p) => p.id).filter((v): v is number => v !== undefined);
    if (submittedIds.length > 0) {
      const owned = new Set(existing.map((p) => p.id));
      const foreign = submittedIds.filter((pid) => !owned.has(pid));
      if (foreign.length > 0) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Those periods belong to the standard set, which is shared by every version without its own periods. " +
              "Edit it in Academic Data → Time Slots, or give this version custom periods.",
          },
          { status: 409 }
        );
      }
    }

    // A period that still has classes may neither disappear nor be
    // renumbered: the sessions keep pointing at its row, so moving it would
    // silently move those classes to another time.
    const keptIds = new Set(submittedIds);
    const removed = existing.filter((p) => !keptIds.has(p.id));
    const usage = await getPeriodUsage(existing.map((p) => p.id));

    const blockedRemoval = removed.filter((p) => (usage.get(p.id) ?? 0) > 0);
    if (blockedRemoval.length > 0) {
      const names = blockedRemoval
        .map((p) => `period ${p.sortOrder} (${usage.get(p.id)} ${usage.get(p.id) === 1 ? "class" : "classes"})`)
        .join(", ");
      return NextResponse.json(
        { ok: false, error: `Cannot remove ${names} — move or delete those classes first.` },
        { status: 409 }
      );
    }

    const existingById = new Map(existing.map((p) => [p.id, p]));
    const blockedReorder = submitted.filter((p) => {
      if (p.id === undefined) return false;
      const before = existingById.get(p.id);
      return before !== undefined && before.sortOrder !== p.sortOrder && (usage.get(p.id) ?? 0) > 0;
    });
    if (blockedReorder.length > 0) {
      const names = blockedReorder.map((p) => `period ${existingById.get(p.id!)!.sortOrder}`).join(", ");
      return NextResponse.json(
        { ok: false, error: `Cannot renumber ${names} — classes are scheduled in it.` },
        { status: 409 }
      );
    }

    // One transaction: a half-written period set would leave the routine
    // with columns that don't match its sessions.
    await db.$transaction([
      ...removed.map((p) => db.timeSlot.delete({ where: { id: p.id } })),
      ...submitted.map((p) =>
        p.id === undefined
          ? db.timeSlot.create({
              data: {
                versionId: id,
                label: p.label,
                sortOrder: p.sortOrder,
                startTime: p.startTime,
                endTime: p.endTime,
                breakAfter: p.breakAfter,
              },
            })
          : db.timeSlot.update({
              where: { id: p.id },
              data: {
                label: p.label,
                sortOrder: p.sortOrder,
                startTime: p.startTime,
                endTime: p.endTime,
                breakAfter: p.breakAfter,
              },
            })
      ),
    ]);

    const periods = await getPeriodsForVersion(id);
    return NextResponse.json({ ok: true, data: { isOwn: true, periods } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to save periods" }, { status: 500 });
  }
}
