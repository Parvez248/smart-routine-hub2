import { z } from "zod";

export const roomSchema = z.object({
  name: z.string().trim().min(1).max(30),
  capacity: z.coerce.number().int().positive().max(1000),
});

export type RoomInput = z.infer<typeof roomSchema>;
