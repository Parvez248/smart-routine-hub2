// A routine version's own period set (PUT /api/admin/versions/[id]/periods)
// and its special blocks (POST/PATCH .../special-blocks). The structural
// rules a set must satisfy — one break at most, periods in time order, a
// block inside the set's periods — are checked by the routes with the same
// helpers the editor uses (lib/ui/periods.ts), so the dialog can preview
// the exact errors the API would return.
import { z } from "zod";

/** "HH:MM", 24-hour. Stored as a string so no timezone can ever touch it. */
const time = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour HH:MM time, e.g. 14:30");

export const periodSchema = z.object({
  // Present when editing an existing period, absent when adding one. The id
  // matters: a period that already has classes must keep its row, or every
  // session pointing at it would be orphaned.
  id: z.coerce.number().int().positive().optional(),
  label: z.string().trim().min(1).max(40),
  sortOrder: z.coerce.number().int().positive(),
  startTime: time.nullable().optional(),
  endTime: time.nullable().optional(),
  breakAfter: z.boolean().default(false),
});

export const periodSetSchema = z.object({
  periods: z.array(periodSchema).min(1).max(20),
});

export type PeriodInput = z.infer<typeof periodSchema>;
export type PeriodSetInput = z.infer<typeof periodSetSchema>;

export const specialBlockSchema = z.object({
  day: z.enum(["Sat", "Sun", "Mon", "Tues", "Wed"]),
  fromSlot: z.coerce.number().int().positive(),
  toSlot: z.coerce.number().int().positive(),
  label: z.string().trim().min(1).max(60),
  subLabel: z.string().trim().max(80).nullable().optional(),
  allBatches: z.boolean().default(false),
  batchIds: z.array(z.coerce.number().int().positive()).default([]),
});

export type SpecialBlockInput = z.infer<typeof specialBlockSchema>;
