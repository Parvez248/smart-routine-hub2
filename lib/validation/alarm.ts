// Student class reminders (POST/PATCH /api/student/alarms[/[id]]).
// updateAlarmSchema's `.refine` rejects an empty PATCH body — at least one
// of leadMinutes/isActive must actually change something.
import { z } from "zod";

export const createAlarmSchema = z.object({
  sessionId: z.coerce.number().int().positive(),
  leadMinutes: z.coerce.number().int().min(0).max(120).default(15),
});

export type CreateAlarmInput = z.infer<typeof createAlarmSchema>;

export const updateAlarmSchema = z
  .object({
    leadMinutes: z.coerce.number().int().min(0).max(120).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.leadMinutes !== undefined || data.isActive !== undefined, {
    message: "At least one of leadMinutes or isActive is required",
  });

export type UpdateAlarmInput = z.infer<typeof updateAlarmSchema>;
