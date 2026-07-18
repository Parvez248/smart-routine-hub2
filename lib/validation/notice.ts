import { z } from "zod";

export const noticeSchema = z.object({
  title: z.string().trim().min(1).max(150),
  body: z.string().trim().min(1).max(4000),
  audience: z.enum(["ALL", "TEACHERS", "STUDENTS"]).default("ALL"),
});

export type NoticeInput = z.infer<typeof noticeSchema>;
