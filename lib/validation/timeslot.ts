// Admin TimeSlot create/update. `sortOrder` is the schedule-order key the
// rest of the app relies on (break/lab-adjacency rules in labMerge.ts,
// column order in RoutineGrid.tsx) — `label` (e.g. "09:30 – 10:30 am") is
// display text only and is separately parsed for its actual clock time by
// lib/services/timeslot.ts where a real Date is needed.
import { z } from "zod";

export const timeSlotSchema = z.object({
  label: z.string().trim().min(1).max(40),
  sortOrder: z.coerce.number().int().positive(),
});

export type TimeSlotInput = z.infer<typeof timeSlotSchema>;
