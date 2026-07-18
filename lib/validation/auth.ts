import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
  initials: z.string().trim().min(1).max(10),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const verifySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().length(6),
});

export type VerifyInput = z.infer<typeof verifySchema>;
