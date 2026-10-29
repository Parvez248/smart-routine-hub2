/**
 * Read-only queries behind the teacher and student exam pages (Step 51).
 *
 * Strictly read-only: nothing here writes. The admin's own builder keeps
 * using lib/services/exams.ts, which holds the write-side rules; this file
 * only reads, and adds the one rule those pages need:
 *
 *   **a teacher or student may only ever see a published term.**
 *
 * That rule lives here, in `getPublishedTermExams`, rather than in each
 * route, so there is a single place it can be got right — the routes just
 * turn a null result into a 404.
 */
import { getDb } from "@/lib/db";
import { formatExamDate as toISODate } from "@/lib/ui/examTime";
import type { ViewExam } from "@/lib/ui/examFormat";
import type { ExamSittingValue, ExamTypeValue } from "@/lib/ui/examType";

/** A published term as the term picker lists it. */
export type PublishedTerm = {
  id: number;
  name: string;
  note: string | null;
  counts: { midterm: number; final: number; lab: number };
};

/** Every published term, newest first, with its exam counts. */
export async function getPublishedTerms(): Promise<PublishedTerm[]> {
  const db = getDb();
  const terms = await db.examTerm.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
    include: { exams: { select: { type: true, course: { select: { type: true } } } } },
  });

  return terms.map((term) => ({
    id: term.id,
    name: term.name,
    note: term.note,
    counts: {
      midterm: term.exams.filter((e) => e.type === "MIDTERM").length,
      final: term.exams.filter((e) => e.type === "FINAL").length,
      lab: term.exams.filter((e) => e.course.type === "LAB").length,
    },
  }));
}

/** A course+batch pair a teacher is responsible for. */
export type CourseBatchPair = { courseId: number; batchId: number };

/**
 * The course+batch pairs this teacher teaches in the **published** class
 * routine — what "My exams" is matched on. Deliberately keyed on the class
 * routine rather than on anything stored against the exam: an Exam has no
 * teacher of its own (invigilation isn't modelled), so who "owns" an exam
 * can only be inferred from who teaches that course to that batch.
 *
 * Cancelled sessions still count: a teacher whose class was cancelled one
 * week still teaches the course, and still wants its exam.
 */
export async function getTeacherCourseBatchPairs(teacherId: number): Promise<CourseBatchPair[]> {
  const db = getDb();
  const published = await db.routineVersion.findFirst({ where: { isPublished: true } });
  if (!published) return [];

  return db.session.findMany({
    where: { versionId: published.id, teacherId },
    select: { courseId: true, batchId: true },
    distinct: ["courseId", "batchId"],
  });
}

type ExamFilter = {
  /** Only this batch's exams — the student's "My batch". */
  batchId?: number;
  /** Only these course+batch pairs — the teacher's "My exams". */
  pairs?: CourseBatchPair[];
};

// Midterms are always listed before finals, whatever their dates.
const TYPE_ORDER: Record<ExamTypeValue, number> = { MIDTERM: 0, FINAL: 1 };

/**
 * One published term's exams, in reading order: midterms first, then by
 * date, start time and batch name.
 *
 * Returns **null** when the term doesn't exist or isn't published — which
 * the routes turn into a 404, so an unpublished term is indistinguishable
 * from a missing one to a teacher or student.
 */
export async function getPublishedTermExams(
  termId: number,
  filter: ExamFilter = {}
): Promise<{ term: PublishedTerm; exams: ViewExam[] } | null> {
  const db = getDb();
  const term = await db.examTerm.findUnique({
    where: { id: termId },
    include: { exams: { select: { type: true, course: { select: { type: true } } } } },
  });
  if (!term || !term.isPublished) return null;

  // An empty `pairs` list means "this teacher teaches nothing in the
  // published routine", which must return no exams — not every exam. A
  // `where` of OR: [] would match nothing in Prisma, but being explicit
  // here keeps that from depending on a subtlety.
  if (filter.pairs && filter.pairs.length === 0) {
    return { term: toPublishedTerm(term), exams: [] };
  }

  const rows = await db.exam.findMany({
    where: {
      termId,
      ...(filter.batchId ? { batchId: filter.batchId } : {}),
      ...(filter.pairs
        ? { OR: filter.pairs.map((p) => ({ courseId: p.courseId, batchId: p.batchId })) }
        : {}),
    },
    include: {
      course: true,
      batch: true,
      rooms: { include: { room: true } },
    },
  });

  const exams: ViewExam[] = rows.map((row) => ({
    id: row.id,
    type: row.type as ExamTypeValue,
    // The `@db.Date` column comes back as a Date at UTC midnight; this
    // reads its UTC parts, so the date can never slip a day on the way out.
    date: toISODate(row.date),
    sitting: row.sitting as ExamSittingValue,
    startTime: row.startTime,
    endTime: row.endTime,
    course: { code: row.course.code, title: row.course.title, type: row.course.type },
    batch: { id: row.batch.id, name: row.batch.name, semester: row.batch.semester },
    section: row.section,
    rooms: row.rooms
      .map((r) => ({ name: r.room.name, capacity: r.room.capacity, seats: r.seats }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
  }));

  exams.sort(
    (a, b) =>
      TYPE_ORDER[a.type] - TYPE_ORDER[b.type] ||
      a.date.localeCompare(b.date) ||
      a.startTime.localeCompare(b.startTime) ||
      a.batch.name.localeCompare(b.batch.name, undefined, { numeric: true })
  );

  return { term: toPublishedTerm(term), exams };
}

function toPublishedTerm(term: {
  id: number;
  name: string;
  note: string | null;
  exams: { type: string; course: { type: string } }[];
}): PublishedTerm {
  return {
    id: term.id,
    name: term.name,
    note: term.note,
    counts: {
      midterm: term.exams.filter((e) => e.type === "MIDTERM").length,
      final: term.exams.filter((e) => e.type === "FINAL").length,
      lab: term.exams.filter((e) => e.course.type === "LAB").length,
    },
  };
}
