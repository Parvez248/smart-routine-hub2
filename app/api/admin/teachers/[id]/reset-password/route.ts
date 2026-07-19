import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resetTeacherPassword } from "@/lib/services/teacherAccounts";

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
    const result = await resetTeacherPassword(id);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
    }
    return NextResponse.json({ ok: true, data: result.data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to reset password" }, { status: 500 });
  }
}
