/**
 * Teacher self-registration. Public (no auth required — this IS how a
 * teacher gets an account). Body: name/email/password/initials
 * (registerSchema). Creates the User (role TEACHER, status PENDING,
 * emailVerified false) and, in the same transaction, either links to an
 * existing Teacher row by initials (e.g. one already in the schedule from
 * a routine import, via `Teacher.userId`) or creates a new Teacher row —
 * this is the one place that link is established; see ./verify for the
 * next step and app/api/admin/teacher-requests for the approval after that.
 * A 6-digit email verification code is generated and (since there's no
 * email service wired up) logged to the server console rather than
 * actually emailed — `devVerifyCode` is also returned in the response for
 * the same reason. 409 if the email or initials are already taken.
 */
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
    if (existingTeacher && existingTeacher.userId) {
      return NextResponse.json({ ok: false, error: "Teacher initials already exist" }, { status: 409 });
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
          role: "TEACHER",
          status: "PENDING",
          emailVerified: false,
          verifyCode,
          verifyCodeExpires,
        },
      });

      if (existingTeacher) {
        await tx.teacher.update({ where: { id: existingTeacher.id }, data: { userId: user.id } });
      } else {
        await tx.teacher.create({ data: { initials, name, userId: user.id } });
      }
    });

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
