import { z } from "zod";

export const rescheduleSchema = z.object({
  newDay: z.enum(["Sat", "Sun", "Mon", "Tues", "Wed"]),
  newTimeSlotId: z.coerce.number().int().positive(),
  newRoomId: z.coerce.number().int().positive(),
  reason: z.string().trim().min(1).max(500).optional().nullable(),
});

export type RescheduleInput = z.infer<typeof rescheduleSchema>;
