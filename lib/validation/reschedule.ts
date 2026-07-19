import { z } from "zod";

export const rescheduleRequestSchema = z.object({
  sessionId: z.coerce.number().int().positive(),
  newDay: z.enum(["Sat", "Sun", "Mon", "Tues", "Wed"]),
  newTimeSlotId: z.coerce.number().int().positive(),
  newRoomId: z.coerce.number().int().positive(),
  reason: z.string().trim().min(1).max(500).optional().nullable(),
});

export type RescheduleRequestInput = z.infer<typeof rescheduleRequestSchema>;

export const reviewRescheduleSchema = z.object({
  action: z.enum(["approve", "reject"]),
  adminNote: z.string().trim().max(500).optional().nullable(),
});

export type ReviewRescheduleInput = z.infer<typeof reviewRescheduleSchema>;
