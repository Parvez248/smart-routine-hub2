/**
 * A signed-in teacher changes their own password — used both for a
 * voluntary change and to clear the forced first-login change (see
 * proxy.ts's mustChangePassword redirect). Requires the current password
 * to match (400 if not); on success clears `mustChangePassword` in the
 * database. Note this alone does NOT update the caller's live JWT — the
 * client must call NextAuth's `update()` afterwards (which the
 * change-password page does) to trigger the `trigger === "update"` branch
 * in lib/auth.ts's jwt callback and pick up the fresh value; otherwise the
 * token would keep redirecting them back here for the rest of the session.
 */
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { changePasswordSchema } from "@/lib/validation/changePassword";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "TEACHER") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const db = getDb();
    const userId = Number(session.user.id);
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ ok: false, error: "Account not found" }, { status: 404 });
    }

    const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ ok: false, error: "Current password is incorrect" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await db.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to change password" }, { status: 500 });
  }
}
