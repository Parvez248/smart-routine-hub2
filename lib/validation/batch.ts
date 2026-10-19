// Admin Batch create/update. `semester` is free text (e.g. "5th") parsed
// for its leading number elsewhere (RoutineGrid.tsx's band-colour-by-
// seniority logic) — not constrained to a specific format here.
// `studentCount` feeds checkCapacity in scheduling.ts.
import { z } from "zod";

export const batchSchema = z.object({
  name: z.string().trim().min(1).max(30),
  semester: z.string().trim().min(1).max(20),
  studentCount: z.coerce.number().int().min(0).max(1000),
  // 1 = no sections, 2 = Sec 1 + Sec 2 (Step 50). Only these two are
  // supported; more sections per batch is explicitly out of scope.
  // Defaults to 1 so an older client that omits it still creates a valid batch.
  sectionCount: z.coerce.number().int().min(1).max(2).default(1),
});

export type BatchInput = z.infer<typeof batchSchema>;
