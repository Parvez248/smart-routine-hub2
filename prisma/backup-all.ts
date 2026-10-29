import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { getDb } from "../lib/db";

/**
 * Exports every table to prisma/backups/<label>-<ts>.json and prints each
 * table's row count, so the counts can be compared again after a
 * migration/backfill. Read-only: writes nothing to the database.
 *
 * The label comes from `--label=<name>` (default "backup") so each step's
 * protection protocol can name its own snapshot — it was originally
 * hard-coded to "pre-step50", which meant editing this file every step.
 *
 * Every table in schema.prisma must appear here; the exam tables (Step 49/
 * 49b) and the per-version period tables (Step 52) were each added when
 * their step's backup had to include them. A table added by the step that
 * is *about* to run doesn't exist in the database (nor in the generated
 * client) when its own pre-migration snapshot is taken, so each one is
 * read through `tableOrNull`, which reports it as absent instead of
 * aborting the backup that is supposed to protect everything else.
 */
type Delegate = { findMany: () => Promise<unknown[]> };

async function tableOrNull(delegate: unknown): Promise<unknown[] | null> {
  if (!delegate || typeof (delegate as Delegate).findMany !== "function") return null;
  try {
    return await (delegate as Delegate).findMany();
  } catch {
    return null;
  }
}

async function main() {
  const label = process.argv.find((a) => a.startsWith("--label="))?.slice("--label=".length) ?? "backup";
  const db = getDb() as unknown as Record<string, unknown>;

  const [
    users, teachers, students, courses, rooms, batches,
    timeSlots, routineVersions, sessions, reschedules, notices, alarms,
    examTerms, exams, examRooms, specialBlocks, specialBlockBatches,
  ] = await Promise.all([
    tableOrNull(db.user),
    tableOrNull(db.teacher),
    tableOrNull(db.student),
    tableOrNull(db.course),
    tableOrNull(db.room),
    tableOrNull(db.batch),
    tableOrNull(db.timeSlot),
    tableOrNull(db.routineVersion),
    tableOrNull(db.session),
    tableOrNull(db.reschedule),
    tableOrNull(db.notice),
    tableOrNull(db.alarm),
    tableOrNull(db.examTerm),
    tableOrNull(db.exam),
    tableOrNull(db.examRoom),
    tableOrNull(db.specialBlock),
    tableOrNull(db.specialBlockBatch),
  ]);

  const tables: Record<string, unknown[] | null> = {
    User: users, Teacher: teachers, Student: students, Course: courses,
    Room: rooms, Batch: batches, TimeSlot: timeSlots,
    RoutineVersion: routineVersions, Session: sessions,
    Reschedule: reschedules, Notice: notices, Alarm: alarms,
    ExamTerm: examTerms, Exam: exams, ExamRoom: examRooms,
    SpecialBlock: specialBlocks, SpecialBlockBatch: specialBlockBatches,
  };

  const dir = join(__dirname, "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(dir, `${label}-${stamp}.json`);
  writeFileSync(path, JSON.stringify(tables, null, 2));

  console.log(`Backup written to ${path}\n`);
  console.log("=== ROW COUNTS ===");
  for (const [table, rows] of Object.entries(tables)) {
    console.log(
      rows === null
        ? `${table.padEnd(18)}    —   (table not present yet)`
        : `${table.padEnd(18)} ${String(rows.length).padStart(4)}`
    );
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
