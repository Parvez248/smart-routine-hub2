import { z } from "zod";

export const courseSchema = z.object({
  code: z.string().trim().min(2).max(20),
  title: z.string().trim().min(1).max(120),
  type: z.enum(["THEORY", "LAB"]),
});

export type CourseInput = z.infer<typeof courseSchema>;
