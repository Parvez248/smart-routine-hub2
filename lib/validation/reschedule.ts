import { z } from "zod";

const dateOnlyString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

export const rescheduleRequestSchema = z.object({
  sessionId: z.coerce.number().int().positive(),
  originalDate: dateOnlyString,
  newDate: dateOnlyString,
  newTimeSlotId: z.coerce.number().int().positive(),
  newRoomId: z.coerce.number().int().positive(),
  reason: z.string().trim().min(1).max(500).optional().nullable(),
});

export type RescheduleRequestInput = z.infer<typeof rescheduleRequestSchema>;

export const reviewRescheduleSchema = z.object({
  action: z.enum(["approve", "reject", "revert"]),
  adminNote: z.string().trim().max(500).optional().nullable(),
});

export type ReviewRescheduleInput = z.infer<typeof reviewRescheduleSchema>;
