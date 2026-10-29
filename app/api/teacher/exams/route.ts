/**
 * A teacher's view of one published exam term (Step 51).
 *
 * `?termId=` is required and `?scope=mine|all` chooses between the exams
 * of the courses they teach and the whole term. 404 when the term isn't
 * published — getPublishedTermExams holds that rule.
 *
 * "Mine" is matched on the course+batch pairs the teacher teaches in the
 * **published class routine** (see getTeacherCourseBatchPairs): an Exam
 * carries no teacher of its own, because invigilation isn't modelled. The
 * exam's section is shown as stored and never matched against — a teacher
 * taking Sec 1 of a course still wants to see the Sec 2 exam.
 *
 * Read-only: GET only, and nothing here writes.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedTeacher } from "@/lib/services/teacher-auth";
import { getPublishedTermExams, getTeacherCourseBatchPairs } from "@/lib/services/examViews";

const querySchema = z.object({
  termId: z.coerce.number().int().positive(),
  scope: z.enum(["mine", "all"]).default("all"),
});

export async function GET(req: NextRequest) {
  const teacher = await getAuthenticatedTeacher();
  if (!teacher) {
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
    const pairs = parsed.data.scope === "mine" ? await getTeacherCourseBatchPairs(teacher.id) : undefined;
    const result = await getPublishedTermExams(parsed.data.termId, { ...(pairs ? { pairs } : {}) });
    if (!result) {
      return NextResponse.json({ ok: false, error: "Exam term not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      data: { ...result, scope: parsed.data.scope, teachesCount: pairs?.length ?? null },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false, error: "Failed to load exams" }, { status: 500 });
  }
}
