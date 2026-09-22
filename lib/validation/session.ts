// Shared by every session-writing endpoint (POST/PATCH /api/sessions[/[id]],
// PATCH /api/sessions/[id]/status uses a separate, smaller schema). `section`
// is free-form text here — "Sec 1"/"Sec 2"/"Both" are conventions enforced
// by lib/ui/sections.ts and the UI, not by this schema.
import { z } from "zod";

export const createSessionSchema = z.object({
  day: z.enum(["Sat", "Sun", "Mon", "Tues", "Wed"]),
  timeSlotId: z.coerce.number().int().positive(),
  batchId:    z.coerce.number().int().positive(),
  courseId:   z.coerce.number().int().positive(),
  teacherId:  z.coerce.number().int().positive(),
  roomId:     z.coerce.number().int().positive(),
  versionId:  z.coerce.number().int().positive(),
  section:    z.string().trim().min(1).max(20).optional().nullable(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
