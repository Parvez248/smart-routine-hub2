import { z } from "zod";

export const registerStudentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  batchId: z.coerce.number().int().positive(),
  studentId: z.string().trim().min(1).max(40).optional().nullable(),
});

export type RegisterStudentInput = z.infer<typeof registerStudentSchema>;
