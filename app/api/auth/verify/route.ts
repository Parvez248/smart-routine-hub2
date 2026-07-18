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
