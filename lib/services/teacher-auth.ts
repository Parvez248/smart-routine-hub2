import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function getAuthenticatedTeacher() {
  const session = await auth();
  if (session?.user?.role !== "TEACHER") return null;

  const db = getDb();
  return db.teacher.findUnique({ where: { userId: Number(session.user.id) } });
}
