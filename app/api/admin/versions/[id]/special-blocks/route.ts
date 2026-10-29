/**
 * A routine version's special blocks (Step 52) — the non-class bands drawn
 * across the routine, i.e. Club Activities. Admin-only.
 *   GET  — this version's blocks, each with its batch ids.
 *   POST — add one.
 * PATCH/DELETE for one block live in ./[blockId]/route.ts.
 *
 * A block is display-only: it is never a Session, so nothing here touches
 * the conflict, capacity or section rules.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getSpecialBlocks, validateSpecialBlock } from "@/lib/services/periods";
import { specialBlockSchema, type SpecialBlockInput } from "@/lib/validation/periods";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const version = await db.routineVersion.findUnique({ where: { id } });
    if (!version) {
      return NextResponse.json({ ok: false, error: "Version not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: await getSpecialBlocks(id) });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load special blocks" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const parsed = specialBlockSchema.safeParse(body);
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

    const invalid = await validateSpecialBlock(id, parsed.data);
    if (invalid) {
      return NextResponse.json({ ok: false, error: invalid }, { status: 400 });
    }

    const { batchIds, allBatches, subLabel, ...rest } = parsed.data;
    const created = await db.specialBlock.create({
      data: {
        ...rest,
        subLabel: subLabel?.trim() || null,
        allBatches,
        versionId: id,
        // An all-batches block keeps no batch rows at all, so turning it
        // into a batch-scoped one later can't inherit a stale list.
        batches: allBatches ? undefined : { create: batchIds.map((batchId) => ({ batchId })) },
      },
    });

    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to create special block" }, { status: 500 });
  }
}
