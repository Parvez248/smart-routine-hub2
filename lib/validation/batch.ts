import { z } from "zod";

export const batchSchema = z.object({
  name: z.string().trim().min(1).max(30),
  semester: z.string().trim().min(1).max(20),
  studentCount: z.coerce.number().int().min(0).max(1000),
});

export type BatchInput = z.infer<typeof batchSchema>;
