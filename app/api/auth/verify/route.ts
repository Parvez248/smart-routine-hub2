/**
 * Confirm the 6-digit code from register/register-student. Public. Body:
 * `{ email, code }`. Rejects (400, generically "Invalid or expired code" —
 * doesn't distinguish wrong-code from expired, to avoid leaking which) if
 * the code doesn't match or its TTL (15 minutes, set at registration) has
 * passed. On success, clears the code (single-use) and sets
 * `emailVerified: true` — for a teacher this still leaves them PENDING
 * admin approval (see /api/admin/teacher-requests); for a student this is
 * the last gate before they can sign in, since student status is already ACTIVE.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { verifySchema } from "@/lib/validation/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const { email, code } = parsed.data;

    const db = getDb();
    const user = await db.user.findUnique({ where: { email } });

    if (
      !user ||
      !user.verifyCode ||
      user.verifyCode !== code ||
      !user.verifyCodeExpires ||
      user.verifyCodeExpires < new Date()
    ) {
      return NextResponse.json({ ok: false, error: "Invalid or expired code" }, { status: 400 });
    }

    await db.user.update({
      where: { email },
      data: { emailVerified: true, verifyCode: null, verifyCodeExpires: null },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to verify" }, { status: 500 });
  }
}
