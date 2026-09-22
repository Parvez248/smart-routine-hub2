/**
 * Admin-initiated teacher login creation — the alternative to a teacher
 * self-registering (see /api/auth/register). For a teacher who was
 * imported straight into the Teacher table (e.g. by the routine import
 * script) with no User account at all, the admin can generate one here:
 * a random password and an @hamdard.local email derived from their
 * initials, returned once so the admin can hand it to the teacher. Unlike
 * self-registration this skips the PENDING/emailVerified dance entirely —
 * the admin creating the login IS the approval, so the account is created
 * straight to ACTIVE + emailVerified: true, with mustChangePassword: true
 * standing in for "you must prove you received this and pick your own password".
 */
import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";

export const TEACHER_EMAIL_DOMAIN = "hamdard.local";

// Ambiguous characters (O, 0, l, 1, I) are excluded so a password can be
// typed reliably from a printed slip.
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const ALL = UPPER + LOWER + DIGITS;

function randomChar(charset: string): string {
  return charset[randomInt(charset.length)];
}

export function generatePassword(length = 11): string {
  const chars: string[] = [randomChar(UPPER), randomChar(LOWER), randomChar(DIGITS)];
  while (chars.length < length) {
    chars.push(randomChar(ALL));
  }
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export async function generateTeacherEmail(initials: string): Promise<string> {
  const db = getDb();
  const base = initials.toLowerCase().replace(/[^a-z0-9]/g, "");
  let candidate = `${base}@${TEACHER_EMAIL_DOMAIN}`;
  let suffix = 2;
  while (await db.user.findUnique({ where: { email: candidate } })) {
    candidate = `${base}${suffix}@${TEACHER_EMAIL_DOMAIN}`;
    suffix++;
  }
  return candidate;
}

type Credentials = { initials: string; name: string; email: string; password: string };
type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function createTeacherLogin(teacherId: number): Promise<ServiceResult<Credentials>> {
  const db = getDb();
  const teacher = await db.teacher.findUnique({ where: { id: teacherId } });
  if (!teacher) return { ok: false, error: "Teacher not found" };
  if (teacher.userId) return { ok: false, error: "This teacher already has a login" };

  const email = await generateTeacherEmail(teacher.initials);
  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        passwordHash,
        name: teacher.name,
        role: "TEACHER",
        status: "ACTIVE",
        emailVerified: true,
        mustChangePassword: true,
      },
    });
    await tx.teacher.update({ where: { id: teacher.id }, data: { userId: created.id } });
    return created;
  });

  return {
    ok: true,
    data: { initials: teacher.initials, name: teacher.name, email: user.email, password },
  };
}

export async function resetTeacherPassword(teacherId: number): Promise<ServiceResult<Credentials>> {
  const db = getDb();
  const teacher = await db.teacher.findUnique({ where: { id: teacherId } });
  if (!teacher || !teacher.userId) return { ok: false, error: "This teacher has no login yet" };

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.update({
    where: { id: teacher.userId },
    data: { passwordHash, mustChangePassword: true },
  });

  return {
    ok: true,
    data: { initials: teacher.initials, name: teacher.name, email: user.email, password },
  };
}

// Bulk version of createTeacherLogin, for every teacher who doesn't
// already have one — used after an import introduces new teachers.
// Continues past a per-teacher failure rather than aborting the whole
// batch; each teacher ends up in exactly one of created/skipped/failed.
export async function createLoginsForAllTeachers(): Promise<{
  created: Credentials[];
  skipped: { initials: string; name: string }[];
  failed: { initials: string; reason: string }[];
}> {
  const db = getDb();
  const withoutLogin = await db.teacher.findMany({ where: { userId: null } });
  const withLogin = await db.teacher.findMany({
    where: { userId: { not: null } },
    select: { initials: true, name: true },
  });

  const created: Credentials[] = [];
  const failed: { initials: string; reason: string }[] = [];

  for (const teacher of withoutLogin) {
    const result = await createTeacherLogin(teacher.id);
    if (result.ok) {
      created.push(result.data);
    } else {
      failed.push({ initials: teacher.initials, reason: result.error });
    }
  }

  return { created, skipped: withLogin, failed };
}
