import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { registerStudentSchema } from "@/lib/validation/student";

const VERIFY_CODE_TTL_MS = 15 * 60 * 1000;

function generateVerifyCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerStudentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid input", details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const { name, email, password, batchId, studentId } = parsed.data;

    const db = getDb();

    const [existingUser, batch] = await Promise.all([
      db.user.findUnique({ where: { email } }),
      db.batch.findUnique({ where: { id: batchId } }),
    ]);
    if (existingUser) {
      return NextResponse.json({ ok: false, error: "Email is already registered" }, { status: 409 });
    }
    if (!batch) {
      return NextResponse.json({ ok: false, error: "Invalid batch" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verifyCode = generateVerifyCode();
    const verifyCodeExpires = new Date(Date.now() + VERIFY_CODE_TTL_MS);

    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: "STUDENT",
          status: "ACTIVE",
          emailVerified: false,
          verifyCode,
          verifyCodeExpires,
        },
      });

      await tx.student.create({
        data: { userId: user.id, batchId, studentId: studentId ?? null },
      });
    });

    console.log(`[dev] Verification code for ${email}: ${verifyCode}`);

    return NextResponse.json(
      { ok: true, data: { email, devVerifyCode: verifyCode } },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ ok: false, error: "Email is already registered" }, { status: 409 });
    }
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to register" }, { status: 500 });
  }
}
