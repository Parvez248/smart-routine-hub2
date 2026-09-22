/**
 * Bulk version of create-login: creates a login for every teacher who
 * doesn't already have one (e.g. right after importing a routine that
 * introduced new teachers). Admin-only. Always 200 with a summary
 * (`created`/`skipped`/`failed` per lib/services/teacherAccounts.ts) rather
 * than failing the whole batch if one teacher errors.
 */
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
