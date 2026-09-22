// POST /api/teacher/change-password. currentPassword just needs to be
// non-empty here — it's verified against the stored hash in the route
// handler, not by this schema.
import { z } from "zod";

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
