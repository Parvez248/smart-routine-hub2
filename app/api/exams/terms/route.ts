/**
 * The published exam terms, newest first, with their midterm/final/lab
 * counts — what the term picker on the teacher and student exam pages
 * lists (Step 51).
 *
 * Any signed-in user may read it; unpublished terms never appear, for
 * anyone, since the query itself only ever selects published ones. Admins
 * who need draft terms keep using /api/admin/exam-terms.
 *
 * Read-only: GET only, and nothing here writes.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPublishedTerms } from "@/lib/services/examViews";

export async function GET() {
  // proxy.ts doesn't cover /api/*, so this is the route's own auth check.
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const terms = await getPublishedTerms();
    return NextResponse.json({ ok: true, data: terms });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load exam terms" }, { status: 500 });
  }
}
