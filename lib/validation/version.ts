// RoutineVersion create (POST /api/admin/versions) and publish
// (PATCH .../[id] — versionActionSchema; currently the only action is
// "publish", literal-typed so an invalid action is a type error, not just
// a runtime one).
import { z } from "zod";

export const versionSchema = z.object({
  name: z.string().trim().min(1).max(60),
  effectiveDate: z.coerce.date().optional().nullable(),
});

export type VersionInput = z.infer<typeof versionSchema>;

export const versionActionSchema = z.object({
  action: z.literal("publish"),
});
