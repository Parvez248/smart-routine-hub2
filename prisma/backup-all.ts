import "dotenv/config";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { getDb } from "../lib/db";

/**
 * Step 50 part B — export every table to prisma/backups/pre-step50-<ts>.json
 * and print the row count of each, so the counts can be compared again after
 * the migration/backfill (part F.1). Read-only: writes nothing to the database.
 */
async function main() {
  const db = await getDb();

  const [
    users, teachers, students, courses, rooms, batches,
    timeSlots, routineVersions, sessions, reschedules, notices, alarms,
  ] = await Promise.all([
    db.user.findMany(),
    db.teacher.findMany(),
    db.student.findMany(),
    db.course.findMany(),
    db.room.findMany(),
    db.batch.findMany(),
    db.timeSlot.findMany(),
    db.routineVersion.findMany(),
    db.session.findMany(),
    db.reschedule.findMany(),
    db.notice.findMany(),
    db.alarm.findMany(),
  ]);

  const data = {
    User: users, Teacher: teachers, Student: students, Course: courses,
    Room: rooms, Batch: batches, TimeSlot: timeSlots,
    RoutineVersion: routineVersions, Session: sessions,
    Reschedule: reschedules, Notice: notices, Alarm: alarms,
  };

  const dir = join(__dirname, "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(dir, `pre-step50-${stamp}.json`);
  writeFileSync(path, JSON.stringify(data, null, 2));

  console.log(`Backup written to ${path}\n`);
  console.log("=== ROW COUNTS ===");
  for (const [table, rows] of Object.entries(data)) {
    console.log(`${table.padEnd(16)} ${rows.length}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
