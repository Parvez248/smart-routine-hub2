// Student equivalent of getAuthenticatedTeacher (see that file's comment
// for why every app/api/student/** route calls this instead of auth()
// directly, and why it's safe not to re-check status here).
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function getAuthenticatedStudent() {
  const session = await auth();
  if (session?.user?.role !== "STUDENT") return null;

  const db = getDb();
  return db.student.findUnique({ where: { userId: Number(session.user.id) } });
}
