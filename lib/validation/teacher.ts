import { z } from "zod";

export const teacherSchema = z.object({
  initials: z.string().trim().min(1).max(10),
  name: z.string().trim().min(1).max(120),
});

export type TeacherInput = z.infer<typeof teacherSchema>;
