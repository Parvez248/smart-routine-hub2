// Admin exam-term and exam create/update (Step 49). Shape only — the
// scheduling rules (clashes, seating, section-vs-batch) live in
// lib/services/exams.ts and run after parsing, exactly as the session
// endpoints parse with validation/session.ts then call checkConflict.
import { z } from "zod";

export const examTermSchema = z.object({
  name: z.string().trim().min(1).max(60),
  note: z.string().trim().max(500).optional().nullable(),
});

// PATCH may send any subset — renaming a term, editing its note, or just
// flipping isPublished (which POST never sets; a new term starts unpublished).
export const examTermUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  note: z.string().trim().max(500).optional().nullable(),
  isPublished: z.boolean().optional(),
});

// "HH:MM", 24-hour. Kept strict here so a malformed time can never reach the
// database, where it would silently break every overlap comparison.
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24-hour)");

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
  startTime: timeString,
  endTime: timeString,
  // An exam is split across one or more rooms; the seating check sums their
  // capacities. 20 is a sanity ceiling, not a real limit.
  roomIds: z.array(z.coerce.number().int().positive()).min(1).max(20),
});

export type ExamTermInput = z.infer<typeof examTermSchema>;
export type ExamInput = z.infer<typeof examSchema>;
