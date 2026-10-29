/**
 * A student's view of one published exam term (Step 51).
 *
 * `?termId=` is required and `?scope=mine|all` chooses between the
 * student's own batch and the whole term. 404 when the term isn't
 * published — getPublishedTermExams holds that rule, so it can't drift
 * between this route and the teacher's.
 *
 * NOTE `mine` filters by batch only, never by section: the `Student` model
 * has no `section` field, so a Sec 1 and a Sec 2 student of one batch see
 * the same list, including both sections' exams. Same known limitation as
 * /api/student/routine, and the section is shown on each row so a student
 * can tell which is theirs.
 *
 * Read-only: GET only, and nothing here writes.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedStudent } from "@/lib/services/student-auth";
import { getPublishedTermExams } from "@/lib/services/examViews";

const querySchema = z.object({
  termId: z.coerce.number().int().positive(),
  scope: z.enum(["mine", "all"]).default("all"),
});

export async function GET(req: NextRequest) {
  const student = await getAuthenticatedStudent();
  if (!student) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    termId: searchParams.get("termId"),
    ...(searchParams.get("scope") ? { scope: searchParams.get("scope") } : {}),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid query", details: z.flattenError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const result = await getPublishedTermExams(parsed.data.termId, {
      ...(parsed.data.scope === "mine" ? { batchId: student.batchId } : {}),
    });
    if (!result) {
      return NextResponse.json({ ok: false, error: "Exam term not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: { ...result, scope: parsed.data.scope, batchId: student.batchId },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load exams" }, { status: 500 });
  }
}
