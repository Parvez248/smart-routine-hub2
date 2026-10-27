/**
 * "Is this reference row still referenced?" — the counts behind the 409 that
 * the Course, Room and Batch DELETE handlers return.
 *
 * Before Step 49 each handler counted Sessions itself. Now that exams point
 * at the same courses, rooms and batches, deleting one has to be refused
 * while *either* schedule still uses it — otherwise the exam routine would
 * be left pointing at a deleted course. Counting and wording both live here
 * so the three handlers can't drift apart.
 */
import { getDb } from "@/lib/db";

export type Usage = { classCount: number; examCount: number };

export function isInUse(usage: Usage): boolean {
  return usage.classCount > 0 || usage.examCount > 0;
}

/** e.g. "Course is used by 3 classes and 2 exams and cannot be deleted." */
export function usageMessage(entity: string, usage: Usage): string {
  const parts: string[] = [];
  if (usage.classCount > 0) {
    parts.push(`${usage.classCount} ${usage.classCount === 1 ? "class" : "classes"}`);
  }
  if (usage.examCount > 0) {
    parts.push(`${usage.examCount} ${usage.examCount === 1 ? "exam" : "exams"}`);
  }
  return `${entity} is used by ${parts.join(" and ")} and cannot be deleted.`;
}

export async function getCourseUsage(courseId: number): Promise<Usage> {
  const db = getDb();
  const [classCount, examCount] = await Promise.all([
    db.session.count({ where: { courseId } }),
    db.exam.count({ where: { courseId } }),
  ]);
  return { classCount, examCount };
}

// Rooms reach exams through the ExamRoom join table (an exam occupies
// several rooms), so this counts the exams booked into the room rather than
// the join rows — "2 exams" reads right, "2 room bookings" wouldn't.
export async function getRoomUsage(roomId: number): Promise<Usage> {
  const db = getDb();
  const [classCount, examCount] = await Promise.all([
    db.session.count({ where: { roomId } }),
    db.exam.count({ where: { rooms: { some: { roomId } } } }),
  ]);
  return { classCount, examCount };
}

export async function getBatchUsage(batchId: number): Promise<Usage> {
  const db = getDb();
  const [classCount, examCount] = await Promise.all([
    db.session.count({ where: { batchId } }),
    db.exam.count({ where: { batchId } }),
  ]);
  return { classCount, examCount };
}
