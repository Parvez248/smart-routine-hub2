import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createLoginsForAllTeachers } from "@/lib/services/teacherAccounts";

export async function POST() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await createLoginsForAllTeachers();
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to create logins" }, { status: 500 });
  }
}
