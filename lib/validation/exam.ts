// Admin exam-term and exam create/update. Shape only — the scheduling rules
// (batch clashes, per-sitting room capacity, section-vs-batch) live in
// lib/services/exams.ts and run after parsing, exactly as the session
// endpoints parse with validation/session.ts then call checkConflict.
import { z } from "zod";

// "HH:MM", 24-hour. Kept strict here so a malformed time can never reach the
// database, where it would silently break every time comparison.
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");

export const examTermSchema = z.object({
  name: z.string().trim().min(1).max(60),
  note: z.string().trim().max(500).optional().nullable(),
});

// PATCH may send any subset — renaming a term, editing its note, moving its
// sitting times, or just flipping isPublished (which POST never sets; a new
// term starts unpublished).
export const examTermUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  note: z.string().trim().max(500).optional().nullable(),
  isPublished: z.boolean().optional(),
  morningStart: timeString.optional(),
  afternoonStart: timeString.optional(),
});

// One room of an exam. `seats` is how many of this exam's students sit
// there; optional, because an admin may not have split the batch yet, in
// which case the room's capacity simply can't be checked (a warning).
const examRoomSchema = z.object({
  roomId: z.coerce.number().int().positive(),
  seats: z.coerce.number().int().min(1).max(1000).optional().nullable(),
});

export const examSchema = z.object({
  type: z.enum(["MIDTERM", "FINAL"]),
  courseId: z.coerce.number().int().positive(),
  batchId: z.coerce.number().int().positive(),
  // Free-form here; "Sec 1"/"Sec 2"/"Both"/null is enforced against the
  // batch's own sectionCount by isValidSectionFor during the conflict check.
  section: z.string().trim().min(1).max(20).optional().nullable(),
  // Calendar date only. Checked for real-world validity (and parsed to UTC
  // midnight for the `@db.Date` column) by parseExamDate in the route.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  sitting: z.enum(["MORNING", "AFTERNOON"]),
  startTime: timeString,
  endTime: timeString,
  // An exam is split across one or more shared rooms; the capacity check
  // adds up the seats every exam has placed in each of them. 20 is a sanity
  // ceiling, not a real limit.
  rooms: z.array(examRoomSchema).min(1).max(20),
});

export type ExamTermInput = z.infer<typeof examTermSchema>;
export type ExamInput = z.infer<typeof examSchema>;
