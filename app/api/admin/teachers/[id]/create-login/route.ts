/**
 * Give one teacher (who doesn't already have one) a login: admin-only,
 * generates a random password and an @hamdard.local email from their
 * initials (see lib/services/teacherAccounts.ts), returned once in the
 * response body — the admin must relay it to the teacher, since it can't
 * be shown again after this response. `mustChangePassword` is set, so
 * proxy.ts forces them to change it on first sign-in. 409 if this teacher
 * already has a login.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createTeacherLogin } from "@/lib/services/teacherAccounts";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const result = await createTeacherLogin(id);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
    }
    return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to create login" }, { status: 500 });
  }
}
