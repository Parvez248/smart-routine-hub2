/**
 * The signed-in user's Teacher row, or null if they're not a signed-in
 * teacher. This is what every `app/api/teacher/**` route calls instead of
 * `auth()` directly, since proxy.ts doesn't protect `/api/*` (see its file
 * header) — this function *is* that route's auth check.
 *
 * Only checks `role === "TEACHER"`, not `status === "ACTIVE"` — that's not
 * a gap: `authorize()` in lib/auth.ts already refuses to issue a session
 * for a non-ACTIVE teacher in the first place, so any existing TEACHER
 * session was ACTIVE at sign-in time. (If an admin deactivates a teacher
 * mid-session, that only takes effect once the client re-fetches the
 * session/JWT — same caveat as proxy.ts's page-level check.)
 */
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function getAuthenticatedTeacher() {
  const session = await auth();
  if (session?.user?.role !== "TEACHER") return null;

  const db = getDb();
  return db.teacher.findUnique({ where: { userId: Number(session.user.id) } });
}
