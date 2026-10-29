/**
 * One special block of one routine version (Step 52). Admin-only.
 *   PATCH  — full replace of the block's day/periods/labels/batches.
 *   DELETE — remove it (its batch rows go with it, by cascade).
 *
 * Both check that the block really belongs to the version in the URL, so a
 * mismatched pair is a 404 rather than an edit to someone else's routine.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { validateSpecialBlock } from "@/lib/services/periods";
import { specialBlockSchema } from "@/lib/validation/periods";

type Params = { params: Promise<{ id: string; blockId: string }> };

function parseIds(id: string, blockId: string): { versionId: number; blockId: number } | null {
  const versionId = Number(id);
  const block = Number(blockId);
  if (!Number.isInteger(versionId) || versionId <= 0) return null;
  if (!Number.isInteger(block) || block <= 0) return null;
  return { versionId, blockId: block };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId, blockId: rawBlockId } = await params;
  const ids = parseIds(rawId, rawBlockId);
  if (!ids) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = specialBlockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const db = getDb();
    const existing = await db.specialBlock.findUnique({ where: { id: ids.blockId } });
    if (!existing || existing.versionId !== ids.versionId) {
      return NextResponse.json({ ok: false, error: "Special block not found" }, { status: 404 });
    }

    const invalid = await validateSpecialBlock(ids.versionId, parsed.data);
    if (invalid) {
      return NextResponse.json({ ok: false, error: invalid }, { status: 400 });
    }

    const { batchIds, allBatches, subLabel, ...rest } = parsed.data;

    // The batch list is replaced wholesale, in one transaction with the
    // block itself, so a block can never be left half-way between "these
    // batches" and "all batches".
    const [, updated] = await db.$transaction([
      db.specialBlockBatch.deleteMany({ where: { specialBlockId: ids.blockId } }),
      db.specialBlock.update({
        where: { id: ids.blockId },
        data: {
          ...rest,
          subLabel: subLabel?.trim() || null,
          allBatches,
          batches: allBatches ? undefined : { create: batchIds.map((batchId) => ({ batchId })) },
        },
      }),
    ]);

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to update special block" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId, blockId: rawBlockId } = await params;
  const ids = parseIds(rawId, rawBlockId);
  if (!ids) {
    return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });
  }

  try {
    const db = getDb();
    const existing = await db.specialBlock.findUnique({ where: { id: ids.blockId } });
    if (!existing || existing.versionId !== ids.versionId) {
      return NextResponse.json({ ok: false, error: "Special block not found" }, { status: 404 });
    }

    await db.specialBlock.delete({ where: { id: ids.blockId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to delete special block" }, { status: 500 });
  }
}
