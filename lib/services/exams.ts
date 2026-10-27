/**
 * The exam-routine engine — the conflict rules for the exam schedule, the
 * counterpart to scheduling.ts for the weekly class routine (Step 49).
 *
 * Deliberately a separate engine, because an exam asks different questions
 * from a class:
 *  - no day-of-week or TimeSlot: an exam has a calendar date and its own
 *    start/end time, and may fall on a Thursday or Saturday;
 *  - no teacher: invigilation isn't modelled, so there is no teacher clash;
 *  - several rooms at once: a batch is split across rooms (228, 251, 103),
 *    so the room check is per-room and seating is the *sum* of capacities;
 *  - no cancellations or reschedules, so there is no "effective schedule"
 *    indirection — the Exam rows *are* the schedule.
 *
 * What is shared with the class routine is the section rule: it is imported
 * from lib/ui/sections.ts (`sectionsIntersect`, `isValidSectionFor`) rather
 * than re-implemented, so "Both" means the same thing in both schedules.
 *
 * Clashes are checked across *all* terms, not just the exam's own: a batch
 * can't sit two exams at once and a room can't host two exams at once, no
 * matter which term row each belongs to. Only the duplicate check is
 * scoped to one term and type.
 */
import { getDb } from "@/lib/db";
import {
  isValidSectionFor,
  sectionErrorFor,
  sectionLabel,
  sectionsIntersect,
  studentsInSection,
} from "@/lib/ui/sections";
import { overlaps, timeToMinutes } from "@/lib/ui/examTime";
import { EXAM_TYPE_LABELS } from "@/lib/ui/examType";
import type { ExamTypeValue } from "@/lib/ui/examType";

type ExamConflictInput = {
  termId: number;
  type: ExamTypeValue;
  courseId: number;
  batchId: number;
  section?: string | null;
  date: Date;
  startTime: string;
  endTime: string;
  roomIds: number[];
  // Pass the exam's own id when editing it, so it doesn't clash with itself.
  excludeExamId?: number;
};

/**
 * `errors` block the save; `warnings` don't — they're shown next to the
 * save button so the admin can go ahead knowingly (a batch sitting two
 * exams on one day is tiring but legal; a missing student count only means
 * seating couldn't be checked).
 */
export type ExamConflictResult = { ok: boolean; errors: string[]; warnings: string[] };

/**
 * Every rule an exam must pass before being created or edited. Called by
 * POST /api/admin/exam-terms/[id]/exams and PATCH /api/admin/exams/[id] —
 * the only two paths that write an Exam — so the rules can't diverge
 * between creating and editing.
 */
export async function checkExamConflicts(input: ExamConflictInput): Promise<ExamConflictResult> {
  const db = getDb();
  const errors: string[] = [];
  const warnings: string[] = [];
  const section = input.section?.trim() || null;

  const start = timeToMinutes(input.startTime);
  const end = timeToMinutes(input.endTime);
  if (start === null || end === null) {
    return { ok: false, errors: ["Start and end time must both be in HH:MM (24-hour) form."], warnings };
  }
  if (end <= start) {
    return { ok: false, errors: ["The exam must end after it starts."], warnings };
  }
  const window = { start, end };

  const [batch, course, rooms] = await Promise.all([
    db.batch.findUnique({ where: { id: input.batchId } }),
    db.course.findUnique({ where: { id: input.courseId } }),
    input.roomIds.length ? db.room.findMany({ where: { id: { in: input.roomIds } } }) : Promise.resolve([]),
  ]);

  // Bad ids are a broken client, not something to report alongside scheduling
  // advice — bail out rather than produce misleading messages from null data.
  if (!batch) return { ok: false, errors: ["Invalid batch"], warnings };
  if (!course) return { ok: false, errors: ["Invalid course"], warnings };
  if (rooms.length !== input.roomIds.length) return { ok: false, errors: ["Invalid room"], warnings };

  // Same section vocabulary as the class routine, same single source of truth.
  if (!isValidSectionFor(batch.sectionCount, section)) errors.push(sectionErrorFor(batch));

  if (input.roomIds.length === 0) {
    errors.push("Choose at least one room for this exam.");
  } else {
    const seats = rooms.reduce((sum, r) => sum + r.capacity, 0);
    const sitting = studentsInSection(batch, section);
    if (batch.studentCount === 0) {
      warnings.push(`Batch ${batch.name} has no student count set, so seating wasn't checked.`);
    } else if (seats < sitting) {
      errors.push(
        `The chosen rooms seat ${seats}, but ${sitting} students sit this exam — add another room.`
      );
    }
  }

  // Everything below compares against the other exams on the same calendar
  // date, in every term (see the file header).
  const sameDate = await db.exam.findMany({
    where: {
      date: input.date,
      ...(input.excludeExamId ? { id: { not: input.excludeExamId } } : {}),
    },
    include: { course: true, rooms: { include: { room: true } } },
  });

  const colliding = sameDate.filter((e) => {
    const otherStart = timeToMinutes(e.startTime);
    const otherEnd = timeToMinutes(e.endTime);
    if (otherStart === null || otherEnd === null) return false;
    return overlaps(window, { start: otherStart, end: otherEnd });
  });

  // A batch can't sit two exams at once. "Both" collides with either
  // concrete section; Sec 1 and Sec 2 may sit different exams in parallel.
  const batchClash = colliding.find(
    (e) => e.batchId === input.batchId && sectionsIntersect(e.section, section)
  );
  if (batchClash) {
    const label = sectionLabel(section);
    errors.push(
      `Batch ${batch.name}${label ? ` (${label})` : ""} already sits ${batchClash.course.code} at this time.`
    );
  }

  // A room can't host two exams at once. All offending rooms are named at
  // once so the admin can fix the selection in one pass.
  const requestedRoomIds = new Set(input.roomIds);
  const busyRoomNames = [
    ...new Set(
      colliding.flatMap((e) =>
        e.rooms.filter((er) => requestedRoomIds.has(er.roomId)).map((er) => er.room.name)
      )
    ),
  ];
  if (busyRoomNames.length > 0) {
    const plural = busyRoomNames.length > 1;
    errors.push(
      `Room${plural ? "s" : ""} ${busyRoomNames.join(", ")} ${plural ? "are" : "is"} already booked for another exam at this time.`
    );
  }

  // The same course can't be set twice for the same batch+section within one
  // term's Midterm (or Final) — that's a double entry, not a scheduling clash,
  // so it's checked per term and type rather than per date.
  const duplicate = await db.exam.findFirst({
    where: {
      termId: input.termId,
      type: input.type,
      courseId: input.courseId,
      batchId: input.batchId,
      section,
      ...(input.excludeExamId ? { id: { not: input.excludeExamId } } : {}),
    },
  });
  if (duplicate) {
    const label = sectionLabel(section);
    errors.push(
      `${course.code} is already in this term's ${EXAM_TYPE_LABELS[input.type]} for batch ${batch.name}${label ? ` (${label})` : ""}.`
    );
  }

  // Not an error: legal, but worth seeing before saving.
  const otherExamsThatDay = sameDate.filter(
    (e) =>
      e.batchId === input.batchId &&
      sectionsIntersect(e.section, section) &&
      !colliding.includes(e)
  );
  if (otherExamsThatDay.length > 0) {
    const codes = otherExamsThatDay.map((e) => e.course.code).join(", ");
    warnings.push(
      `Batch ${batch.name} already has ${otherExamsThatDay.length === 1 ? "an exam" : `${otherExamsThatDay.length} exams`} on this date (${codes}).`
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * "Find free rooms" for the exam dialog — every room not already hosting an
 * exam that overlaps this date+time. Room-only, like getFreeRooms in
 * scheduling.ts: the point is "which rooms could I use here", so it ignores
 * batch and seating.
 */
export async function getFreeRoomsForExam(
  date: Date,
  startTime: string,
  endTime: string,
  excludeExamId?: number
) {
  const db = getDb();
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start === null || end === null || end <= start) return [];

  const [rooms, sameDate] = await Promise.all([
    db.room.findMany({ orderBy: { name: "asc" } }),
    db.exam.findMany({
      where: { date, ...(excludeExamId ? { id: { not: excludeExamId } } : {}) },
      include: { rooms: true },
    }),
  ]);

  const bookedRoomIds = new Set<number>();
  for (const exam of sameDate) {
    const otherStart = timeToMinutes(exam.startTime);
    const otherEnd = timeToMinutes(exam.endTime);
    if (otherStart === null || otherEnd === null) continue;
    if (overlaps({ start, end }, { start: otherStart, end: otherEnd })) {
      for (const er of exam.rooms) bookedRoomIds.add(er.roomId);
    }
  }

  return rooms.filter((r) => !bookedRoomIds.has(r.id));
}
