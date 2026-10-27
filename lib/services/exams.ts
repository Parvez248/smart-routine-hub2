/**
 * The exam-routine engine — the conflict rules for the exam schedule, the
 * counterpart to scheduling.ts for the weekly class routine.
 *
 * Deliberately a separate engine, because an exam asks different questions
 * from a class:
 *  - no day-of-week or TimeSlot: an exam has a calendar date and belongs to
 *    one of the day's two *sittings*, and may fall on a Thursday or Saturday;
 *  - no teacher: invigilation isn't modelled, so there is no teacher clash;
 *  - no cancellations or reschedules, so there is no "effective schedule"
 *    indirection — the Exam rows *are* the schedule.
 *
 * Step 49b changed the central rule. Rooms are **shared**: the department
 * seats most batches together in the Hall Room, so several batches may use
 * one room in one sitting. The old "this room is already booked" check is
 * therefore gone. What replaces it is a *seat count*: each ExamRoom row says
 * how many of that exam's students sit in that room, and the sum across
 * every exam in the same date+sitting may not exceed the room's capacity.
 *
 * Everything is grouped by date + sitting rather than by clock time. "Is the
 * hall full?" is a question about a sitting, not about overlapping minutes,
 * and two exams in one sitting share the room whether or not their printed
 * times line up exactly.
 *
 * What is shared with the class routine is the section rule: it is imported
 * from lib/ui/sections.ts (`sectionsIntersect`, `isValidSectionFor`) rather
 * than re-implemented, so "Both" means the same thing in both schedules.
 *
 * Clashes are checked across *all* terms, not just the exam's own: a batch
 * can't sit two exams at once and a room's seats are finite no matter which
 * term each exam belongs to. Only the duplicate check is scoped to one term
 * and type.
 */
import { getDb } from "@/lib/db";
import {
  isValidSectionFor,
  sectionErrorFor,
  sectionLabel,
  sectionsIntersect,
  studentsInSection,
} from "@/lib/ui/sections";
import { EXAM_SITTING_LABELS, EXAM_TYPE_LABELS } from "@/lib/ui/examType";
import type { ExamSittingValue, ExamTypeValue } from "@/lib/ui/examType";
import { timeToMinutes } from "@/lib/ui/examTime";
import { roomLabel } from "@/lib/ui/rooms";

/** One room of an exam, with how many of its students sit there. */
export type ExamRoomInput = { roomId: number; seats?: number | null };

type ExamConflictInput = {
  termId: number;
  type: ExamTypeValue;
  courseId: number;
  batchId: number;
  section?: string | null;
  date: Date;
  sitting: ExamSittingValue;
  startTime: string;
  endTime: string;
  rooms: ExamRoomInput[];
  // Pass the exam's own id when editing it, so it doesn't clash with itself.
  excludeExamId?: number;
};

/**
 * `errors` block the save; `warnings` don't — they're shown next to the save
 * button so the admin can go ahead knowingly (a batch sitting exams in both
 * of a day's sittings is tiring but legal; seats that don't add up to the
 * batch size may just mean the batch size is out of date).
 */
export type ExamConflictResult = { ok: boolean; errors: string[]; warnings: string[] };

/** How many seats other exams have already taken in a room, this sitting. */
function seatsTakenIn(
  roomId: number,
  exams: { rooms: { roomId: number; seats: number | null }[] }[]
): number {
  return exams.reduce(
    (total, exam) =>
      total + exam.rooms.filter((r) => r.roomId === roomId).reduce((s, r) => s + (r.seats ?? 0), 0),
    0
  );
}

/**
 * Every rule an exam must pass before being created or edited. Called by
 * POST /api/admin/exam-terms/[id]/exams and PATCH /api/admin/exams/[id] —
 * the only two paths that write an Exam — so the rules can't diverge
 * between creating and editing.
 *
 * Note this does NOT check that the times fall inside the sitting; that is
 * `sittingTimeError` in lib/ui/examTime.ts, which the routes return as a
 * 400 because it's a malformed request rather than a scheduling clash.
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

  const roomIds = input.rooms.map((r) => r.roomId);
  const [batch, course, rooms] = await Promise.all([
    db.batch.findUnique({ where: { id: input.batchId } }),
    db.course.findUnique({ where: { id: input.courseId } }),
    roomIds.length ? db.room.findMany({ where: { id: { in: roomIds } } }) : Promise.resolve([]),
  ]);

  // Bad ids are a broken client, not something to report alongside scheduling
  // advice — bail out rather than produce misleading messages from null data.
  if (!batch) return { ok: false, errors: ["Invalid batch"], warnings };
  if (!course) return { ok: false, errors: ["Invalid course"], warnings };
  if (new Set(roomIds).size !== roomIds.length) {
    return { ok: false, errors: ["The same room is listed twice."], warnings };
  }
  if (rooms.length !== roomIds.length) return { ok: false, errors: ["Invalid room"], warnings };

  // Same section vocabulary as the class routine, same single source of truth.
  if (!isValidSectionFor(batch.sectionCount, section)) errors.push(sectionErrorFor(batch));

  if (input.rooms.length === 0) errors.push("Choose at least one room for this exam.");

  // Every other exam on this date, in any term — partitioned by sitting below.
  const sameDate = await db.exam.findMany({
    where: {
      date: input.date,
      ...(input.excludeExamId ? { id: { not: input.excludeExamId } } : {}),
    },
    include: { course: true, batch: true, rooms: true },
  });
  const sameSitting = sameDate.filter((e) => e.sitting === input.sitting);

  // --- 1. a batch can't sit two exams in one sitting ----------------------
  // "Both" collides with either concrete section; Sec 1 and Sec 2 may sit
  // different exams in the same sitting. Different batches never collide —
  // that is the whole point of sharing the hall.
  const batchClash = sameSitting.find(
    (e) => e.batchId === input.batchId && sectionsIntersect(e.section, section)
  );
  if (batchClash) {
    const label = sectionLabel(section);
    errors.push(
      `Batch ${batch.name}${label ? ` (${label})` : ""} already sits ${batchClash.course.code} in this sitting.`
    );
  }

  // --- 2. a room can't seat more than it holds, per sitting ---------------
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  for (const entry of input.rooms) {
    const room = roomById.get(entry.roomId);
    if (!room) continue;
    const taken = seatsTakenIn(entry.roomId, sameSitting);
    const mine = entry.seats ?? null;

    if (mine === null) {
      warnings.push(`Seats not set for ${roomLabel(room.name)} — capacity not checked.`);
      continue;
    }
    if (taken + mine > room.capacity) {
      errors.push(`${roomLabel(room.name)}: ${taken} + ${mine} > ${room.capacity} seats in this sitting.`);
    }
  }

  // --- 3. the seats should add up to the number of students sitting -------
  const sitting = studentsInSection(batch, section);
  const everySeatGiven = input.rooms.length > 0 && input.rooms.every((r) => typeof r.seats === "number");
  if (batch.studentCount === 0) {
    warnings.push(`Batch ${batch.name} has no student count set, so seat totals weren't checked.`);
  } else if (everySeatGiven) {
    const totalSeats = input.rooms.reduce((sum, r) => sum + (r.seats ?? 0), 0);
    if (totalSeats !== sitting) {
      warnings.push(
        `Seats add up to ${totalSeats}, but ${sitting} students sit this exam.`
      );
    }
  }

  // --- 4. the same course can't be entered twice in one term+type ---------
  // A double entry, not a scheduling clash, so it's checked per term and
  // type rather than per date.
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

  // --- 5. not an error: the batch also sits in the day's other sitting ----
  const otherSitting = sameDate.filter(
    (e) =>
      e.sitting !== input.sitting &&
      e.batchId === input.batchId &&
      sectionsIntersect(e.section, section)
  );
  if (otherSitting.length > 0) {
    const codes = otherSitting.map((e) => e.course.code).join(", ");
    const other = EXAM_SITTING_LABELS[input.sitting === "MORNING" ? "AFTERNOON" : "MORNING"].toLowerCase();
    warnings.push(`Batch ${batch.name} also sits ${codes} in the ${other} sitting on this date.`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** One room's state for a given date + sitting. */
export type RoomAvailability = {
  id: number;
  name: string;
  capacity: number;
  seatsUsed: number;
  seatsLeft: number;
  /** True when some exam in this room didn't say how many students it seats. */
  hasUnknownSeats: boolean;
  occupants: { batchName: string; courseCode: string; seats: number | null }[];
};

/**
 * What every room looks like in one sitting — the replacement for Step 49's
 * getFreeRoomsForExam. Rooms are never hidden for being "in use", because
 * sharing a room is now normal; a room is only *full* when seatsLeft is 0.
 * The occupants let the dialog show who is already there ("Hall Room — 70 of
 * 150 left · 23rd, 24th").
 */
export async function getRoomAvailability(
  date: Date,
  sitting: ExamSittingValue,
  excludeExamId?: number
): Promise<RoomAvailability[]> {
  const db = getDb();
  const [rooms, exams] = await Promise.all([
    db.room.findMany({ orderBy: { name: "asc" } }),
    db.exam.findMany({
      where: { date, sitting, ...(excludeExamId ? { id: { not: excludeExamId } } : {}) },
      include: { course: true, batch: true, rooms: true },
    }),
  ]);

  return rooms.map((room) => {
    const here = exams.filter((e) => e.rooms.some((r) => r.roomId === room.id));
    const seatsUsed = seatsTakenIn(room.id, exams);
    return {
      id: room.id,
      name: room.name,
      capacity: room.capacity,
      seatsUsed,
      seatsLeft: Math.max(0, room.capacity - seatsUsed),
      hasUnknownSeats: here.some((e) => e.rooms.some((r) => r.roomId === room.id && r.seats === null)),
      occupants: here.map((e) => ({
        batchName: e.batch.name,
        courseCode: e.course.code,
        seats: e.rooms.find((r) => r.roomId === room.id)?.seats ?? null,
      })),
    };
  });
}
