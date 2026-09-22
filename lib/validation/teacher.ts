// Admin Teacher create/update — the scheduling identity only (initials
// shown throughout the routine, display name); login/account fields
// (email, password) are managed separately, see teacherAccounts.ts.
import { z } from "zod";

export const teacherSchema = z.object({
  initials: z.string().trim().min(1).max(10),
  name: z.string().trim().min(1).max(120),
});

export type TeacherInput = z.infer<typeof teacherSchema>;
