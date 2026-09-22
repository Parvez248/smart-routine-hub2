/**
 * Approve or reject one pending teacher self-registration. Admin-only.
 * `{ action: "approve" | "reject" }` → sets the User's status to ACTIVE or
 * REJECTED. That's the only effect here — the Teacher↔User link
 * (`Teacher.userId`) and the teacher's own chosen password were already
 * set up at registration time (see /api/auth/register); approving just
 * flips the status so proxy.ts lets them into `/teacher/*`. This is a
 * different path from /api/admin/teachers/[id]/create-login, which is for
 * a teacher who was imported directly into the Teacher table (e.g. by the
 * routine import script) and never self-registered at all.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

const actionSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

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
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const status = parsed.data.action === "approve" ? "ACTIVE" : "REJECTED";

    const db = getDb();
    const user = await db.user.update({ where: { id }, data: { status } });
    return NextResponse.json({ ok: true, data: user });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to update teacher request" }, { status: 500 });
  }
}
