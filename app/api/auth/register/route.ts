import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { registerSchema } from "@/lib/validation/auth";

const VERIFY_CODE_TTL_MS = 15 * 60 * 1000;

function generateVerifyCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const { name, email, password, initials } = parsed.data;

    const db = getDb();

    const [existingUser, existingTeacher] = await Promise.all([
      db.user.findUnique({ where: { email } }),
      db.teacher.findUnique({ where: { initials } }),
    ]);
    if (existingUser) {
      return NextResponse.json({ ok: false, error: "Email is already registered" }, { status: 409 });
    }
    if (existingTeacher) {
      return NextResponse.json({ ok: false, error: "Teacher initials already exist" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verifyCode = generateVerifyCode();
    const verifyCodeExpires = new Date(Date.now() + VERIFY_CODE_TTL_MS);

    await db.$transaction([
      db.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: "TEACHER",
          status: "PENDING",
          emailVerified: false,
          verifyCode,
          verifyCodeExpires,
        },
      }),
      db.teacher.create({ data: { initials, name } }),
    ]);

    console.log(`[dev] Verification code for ${email}: ${verifyCode}`);

    return NextResponse.json(
      { ok: true, data: { email, devVerifyCode: verifyCode } },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ ok: false, error: "Email or initials already exist" }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to register" }, { status: 500 });
  }
}
