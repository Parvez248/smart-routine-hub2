import { z } from "zod";

export const timeSlotSchema = z.object({
  label: z.string().trim().min(1).max(40),
  sortOrder: z.coerce.number().int().positive(),
});

export type TimeSlotInput = z.infer<typeof timeSlotSchema>;
