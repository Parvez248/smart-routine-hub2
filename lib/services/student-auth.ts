import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function getAuthenticatedStudent() {
  const session = await auth();
  if (session?.user?.role !== "STUDENT") return null;

  const db = getDb();
  return db.student.findUnique({ where: { userId: Number(session.user.id) } });
}
