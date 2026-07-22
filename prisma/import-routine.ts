import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../app/generated/prisma/client";

function buildAdapterConfig(url: string) {
  const parsed = new URL(url.replace(/^mysql:/, "mariadb:"));
  const isCloud = parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1";
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "3306"),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1),
    ...(isCloud ? { ssl: { rejectUnauthorized: true } } : {}),
  };
}

type JsonSession = {
  day: string;
  batch: string;
  semester?: string;
  section: string | null;
  slots: number[];
  course: string;
  teacher: string;
  room: string;
};

type JsonData = {
  effectiveDate?: string;
  timeSlots: { id: number; label: string }[];
  teachers: Record<string, string>;
  rooms: { name: string; capacity: number }[];
  batches: { name: string; semester: string }[];
  courses: { code: string; title?: string; type: "LAB" | "THEORY" }[];
  sessions: JsonSession[];
  specialBlocks?: { day: string; label: string; slots: number[]; appliesTo?: string }[];
};

const APPLY = process.argv.includes("--apply");
const VERSION_NAME = "Spring 2026";
const VERSION_EFFECTIVE_DATE = new Date("2026-05-10T00:00:00Z");

const data: JsonData = JSON.parse(readFileSync(join(__dirname, "routine-data.json"), "utf-8"));

function log(...args: unknown[]) {
  console.log(...args);
}

async function main() {
  log(`\n=== Routine Management System routine import — ${APPLY ? "APPLY MODE (will write to the database)" : "DRY RUN (no changes will be made)"} ===`);

  const adapter = new PrismaMariaDb(buildAdapterConfig(process.env.DATABASE_URL!));
  const prisma = new PrismaClient({ adapter });

  // ---------------------------------------------------------------------
  // Phase A: sync reference data (upsert only — never delete)
  // ---------------------------------------------------------------------
  log("\n--- Phase A: sync reference data ---");

  const refReport = {
    timeSlots: { created: 0, updated: 0 },
    teachers: { created: 0, updated: 0 },
    rooms: { created: 0, updated: 0 },
    batches: { created: 0, updated: 0 },
    courses: { created: 0, updated: 0 },
  };

  for (const ts of data.timeSlots) {
    const existing = await prisma.timeSlot.findUnique({ where: { id: ts.id } });
    if (existing) {
      refReport.timeSlots.updated++;
      if (APPLY) await prisma.timeSlot.update({ where: { id: ts.id }, data: { label: ts.label, sortOrder: ts.id } });
    } else {
      refReport.timeSlots.created++;
      if (APPLY) await prisma.timeSlot.create({ data: { id: ts.id, label: ts.label, sortOrder: ts.id } });
    }
  }

  for (const [initials, name] of Object.entries(data.teachers)) {
    const existing = await prisma.teacher.findUnique({ where: { initials } });
    if (existing) {
      refReport.teachers.updated++;
      if (APPLY) await prisma.teacher.update({ where: { initials }, data: { name } });
    } else {
      refReport.teachers.created++;
      if (APPLY) await prisma.teacher.create({ data: { initials, name } });
    }
  }

  for (const room of data.rooms) {
    const existing = await prisma.room.findUnique({ where: { name: room.name } });
    if (existing) {
      refReport.rooms.updated++;
      if (APPLY) await prisma.room.update({ where: { name: room.name }, data: { capacity: room.capacity } });
    } else {
      refReport.rooms.created++;
      if (APPLY) await prisma.room.create({ data: { name: room.name, capacity: room.capacity } });
    }
  }

  for (const batch of data.batches) {
    const existing = await prisma.batch.findUnique({ where: { name: batch.name } });
    if (existing) {
      // Never overwrite studentCount — only semester is synced on an existing row.
      refReport.batches.updated++;
      if (APPLY) await prisma.batch.update({ where: { name: batch.name }, data: { semester: batch.semester } });
    } else {
      refReport.batches.created++;
      if (APPLY) await prisma.batch.create({ data: { name: batch.name, semester: batch.semester, studentCount: 0 } });
    }
  }

  for (const course of data.courses) {
    const existing = await prisma.course.findUnique({ where: { code: course.code } });
    if (existing) {
      refReport.courses.updated++;
      if (APPLY) {
        await prisma.course.update({
          where: { code: course.code },
          data: { type: course.type, title: course.title ?? course.code },
        });
      }
    } else {
      refReport.courses.created++;
      if (APPLY) {
        await prisma.course.create({
          data: { code: course.code, title: course.title ?? course.code, type: course.type },
        });
      }
    }
  }

  log("TimeSlots:", refReport.timeSlots);
  log("Teachers: ", refReport.teachers);
  log("Rooms:    ", refReport.rooms);
  log("Batches:  ", refReport.batches);
  log("Courses:  ", refReport.courses);

  // ---------------------------------------------------------------------
  // Phase B: unknown teacher initials referenced by sessions but missing
  // from the teachers map — create placeholders so no session is lost.
  // ---------------------------------------------------------------------
  log("\n--- Phase B: unknown teacher initials ---");

  const knownInitials = new Set(Object.keys(data.teachers));
  const usedInitials = new Set(data.sessions.map((s) => s.teacher));
  const unknownInitials = [...usedInitials].filter((t) => !knownInitials.has(t)).sort();
  const unknownSessionCounts = new Map(
    unknownInitials.map((t) => [t, data.sessions.filter((s) => s.teacher === t).length])
  );

  if (unknownInitials.length > 0) {
    const totalUnknownSessions = [...unknownSessionCounts.values()].reduce((a, b) => a + b, 0);
    log(
      `⚠ ${unknownInitials.length} unknown teacher initials found, covering ${totalUnknownSessions} session(s):`
    );
    for (const initials of unknownInitials) {
      const placeholderName = `Unknown (${initials})`;
      const existing = await prisma.teacher.findUnique({ where: { initials } });
      const count = unknownSessionCounts.get(initials);
      if (existing) {
        log(`  ${initials}: ${count} session(s) — teacher already exists ("${existing.name}"), left as-is.`);
      } else {
        log(`  ${initials}: ${count} session(s) — will create placeholder "${placeholderName}".`);
        if (APPLY) await prisma.teacher.create({ data: { initials, name: placeholderName } });
      }
    }
    log("  ACTION REQUIRED: rename these teachers under /admin → Academic Data → Teachers once known.");
  } else {
    log("None found — every session's teacher initials are already known.");
  }

  // ---------------------------------------------------------------------
  // Report reference rows that exist in the DB but not in the JSON.
  // These are left alone; just surfaced so the human can decide later.
  // ---------------------------------------------------------------------
  log("\n--- Reference rows in the DB but not in the JSON (left alone) ---");
  const expectedTeacherInitials = new Set([...knownInitials, ...unknownInitials]);
  const [dbTimeSlots, dbTeachers, dbRooms, dbBatches, dbCourses] = await Promise.all([
    prisma.timeSlot.findMany({ select: { id: true } }),
    prisma.teacher.findMany({ select: { initials: true } }),
    prisma.room.findMany({ select: { name: true } }),
    prisma.batch.findMany({ select: { name: true } }),
    prisma.course.findMany({ select: { code: true } }),
  ]);
  const jsonTimeSlotIds = new Set(data.timeSlots.map((t) => t.id));
  const jsonRoomNames = new Set(data.rooms.map((r) => r.name));
  const jsonBatchNames = new Set(data.batches.map((b) => b.name));
  const jsonCourseCodes = new Set(data.courses.map((c) => c.code));

  const extra = {
    timeSlots: dbTimeSlots.filter((t) => !jsonTimeSlotIds.has(t.id)).map((t) => t.id),
    teachers: dbTeachers.filter((t) => !expectedTeacherInitials.has(t.initials)).map((t) => t.initials),
    rooms: dbRooms.filter((r) => !jsonRoomNames.has(r.name)).map((r) => r.name),
    batches: dbBatches.filter((b) => !jsonBatchNames.has(b.name)).map((b) => b.name),
    courses: dbCourses.filter((c) => !jsonCourseCodes.has(c.code)).map((c) => c.code),
  };
  let anyExtra = false;
  for (const [table, rows] of Object.entries(extra)) {
    if (rows.length > 0) {
      anyExtra = true;
      log(`  ${table}: ${rows.join(", ")}`);
    }
  }
  if (!anyExtra) log("  None.");

  // ---------------------------------------------------------------------
  // Phase C: routine version — find or create "Spring 2026", publish it
  // exclusively.
  // ---------------------------------------------------------------------
  log("\n--- Phase C: routine version ---");
  const existingVersion = await prisma.routineVersion.findUnique({ where: { name: VERSION_NAME } });
  log(
    existingVersion
      ? `Version "${VERSION_NAME}" already exists (id ${existingVersion.id}); will (re)publish it exclusively.`
      : `Will create version "${VERSION_NAME}" (effective ${VERSION_EFFECTIVE_DATE.toDateString()}) and publish it.`
  );

  let versionId = existingVersion?.id ?? -1;
  if (APPLY) {
    const version = await prisma.routineVersion.upsert({
      where: { name: VERSION_NAME },
      update: { effectiveDate: VERSION_EFFECTIVE_DATE },
      create: { name: VERSION_NAME, effectiveDate: VERSION_EFFECTIVE_DATE, isPublished: true },
    });
    await prisma.routineVersion.updateMany({ where: { id: { not: version.id } }, data: { isPublished: false } });
    await prisma.routineVersion.update({ where: { id: version.id }, data: { isPublished: true } });
    versionId = version.id;
    log(`Version id: ${versionId} (published).`);
  }

  // ---------------------------------------------------------------------
  // Phase D: clear practice data — Alarm → Reschedule → Session, in that
  // order, and nothing else.
  // ---------------------------------------------------------------------
  log("\n--- Phase D: clear practice sessions ---");
  const [alarmCount, rescheduleCount, sessionCount] = await Promise.all([
    prisma.alarm.count(),
    prisma.reschedule.count(),
    prisma.session.count(),
  ]);
  log(`Current rows — Alarm: ${alarmCount}, Reschedule: ${rescheduleCount}, Session: ${sessionCount}`);
  if (APPLY) {
    const delAlarms = await prisma.alarm.deleteMany({});
    const delReschedules = await prisma.reschedule.deleteMany({});
    const delSessions = await prisma.session.deleteMany({});
    log(
      `Deleted — Alarm: ${delAlarms.count}, Reschedule: ${delReschedules.count}, Session: ${delSessions.count}`
    );
  } else {
    log("Would delete all of the above (Alarm, then Reschedule, then Session). No other table is touched.");
  }

  // ---------------------------------------------------------------------
  // Phase E: insert the real routine, expanding multi-slot entries into
  // one Session row per slot.
  // ---------------------------------------------------------------------
  log("\n--- Phase E: import routine sessions ---");

  const batchIdByName = new Map<string, number>();
  const courseIdByCode = new Map<string, number>();
  const teacherIdByInitials = new Map<string, number>();
  const roomIdByName = new Map<string, number>();
  const timeSlotIdBySlot = new Map<number, number>();

  if (APPLY) {
    for (const b of await prisma.batch.findMany()) batchIdByName.set(b.name, b.id);
    for (const c of await prisma.course.findMany()) courseIdByCode.set(c.code, c.id);
    for (const t of await prisma.teacher.findMany()) teacherIdByInitials.set(t.initials, t.id);
    for (const r of await prisma.room.findMany()) roomIdByName.set(r.name, r.id);
    for (const ts of await prisma.timeSlot.findMany()) timeSlotIdBySlot.set(ts.sortOrder, ts.id);
  } else {
    // Dry run: existence-only checks against what Phase A/B would create.
    for (const b of data.batches) batchIdByName.set(b.name, -1);
    for (const c of data.courses) courseIdByCode.set(c.code, -1);
    for (const initials of expectedTeacherInitials) teacherIdByInitials.set(initials, -1);
    for (const r of data.rooms) roomIdByName.set(r.name, -1);
    for (const ts of data.timeSlots) timeSlotIdBySlot.set(ts.id, -1);
  }

  type PreparedRow = {
    day: string;
    timeSlotId: number;
    batchId: number;
    section: string | null;
    courseId: number;
    teacherId: number;
    roomId: number;
    versionId: number;
    status: "ACTIVE";
    _teacherInitials: string;
    _roomName: string;
    _slot: number;
  };

  const rowsToCreate: PreparedRow[] = [];
  const skipped: { entry: Record<string, unknown>; reason: string }[] = [];

  for (const s of data.sessions) {
    const batchId = batchIdByName.get(s.batch);
    const courseId = courseIdByCode.get(s.course);
    const teacherId = teacherIdByInitials.get(s.teacher);
    const roomId = roomIdByName.get(s.room);

    for (const slot of s.slots) {
      const timeSlotId = timeSlotIdBySlot.get(slot);
      const missing: string[] = [];
      if (batchId === undefined) missing.push(`batch "${s.batch}"`);
      if (courseId === undefined) missing.push(`course "${s.course}"`);
      if (teacherId === undefined) missing.push(`teacher "${s.teacher}"`);
      if (roomId === undefined) missing.push(`room "${s.room}"`);
      if (timeSlotId === undefined) missing.push(`timeSlot ${slot}`);

      if (missing.length > 0) {
        skipped.push({
          entry: { day: s.day, batch: s.batch, course: s.course, teacher: s.teacher, room: s.room, slot },
          reason: `missing ${missing.join(", ")}`,
        });
        continue;
      }

      rowsToCreate.push({
        day: s.day,
        timeSlotId: timeSlotId!,
        batchId: batchId!,
        section: s.section ?? null,
        courseId: courseId!,
        teacherId: teacherId!,
        roomId: roomId!,
        versionId,
        status: "ACTIVE",
        _teacherInitials: s.teacher,
        _roomName: s.room,
        _slot: slot,
      });
    }
  }

  log(`Rows to insert: ${rowsToCreate.length} (expected 165)`);
  if (skipped.length > 0) {
    log(`⚠ Skipped ${skipped.length} row(s):`);
    for (const sk of skipped) log("  ", JSON.stringify(sk.entry), "->", sk.reason);
  } else {
    log("No rows skipped.");
  }

  if (APPLY) {
    for (const row of rowsToCreate) {
      const { _teacherInitials, _roomName, _slot, ...data } = row;
      void _teacherInitials;
      void _roomName;
      void _slot;
      await prisma.session.create({ data });
    }
    log(`Inserted ${rowsToCreate.length} session rows into version "${VERSION_NAME}" (id ${versionId}).`);
  }

  // ---------------------------------------------------------------------
  // Phase F: conflict scan of the imported data (report only).
  // ---------------------------------------------------------------------
  log("\n--- Phase F: conflict scan (within the imported routine) ---");
  const byDaySlot = new Map<string, PreparedRow[]>();
  for (const row of rowsToCreate) {
    const key = `${row.day} slot ${row._slot}`;
    if (!byDaySlot.has(key)) byDaySlot.set(key, []);
    byDaySlot.get(key)!.push(row);
  }
  const conflicts: string[] = [];
  for (const [key, rows] of byDaySlot) {
    const teacherSeen = new Map<string, number>();
    const roomSeen = new Map<string, number>();
    for (const row of rows) {
      teacherSeen.set(row._teacherInitials, (teacherSeen.get(row._teacherInitials) ?? 0) + 1);
      roomSeen.set(row._roomName, (roomSeen.get(row._roomName) ?? 0) + 1);
    }
    for (const [teacher, count] of teacherSeen) {
      if (count > 1) conflicts.push(`${key}: teacher ${teacher} appears ${count} times`);
    }
    for (const [room, count] of roomSeen) {
      if (count > 1) conflicts.push(`${key}: room ${room} appears ${count} times`);
    }
  }
  if (conflicts.length > 0) {
    log(`⚠ ${conflicts.length} potential conflict(s) found in the source data:`);
    conflicts.forEach((c) => log("  ", c));
  } else {
    log("No conflicts found — the imported routine is clean.");
  }

  // ---------------------------------------------------------------------
  // Phase G: specialBlocks — informational only, never inserted as a
  // Session.
  // ---------------------------------------------------------------------
  log("\n--- Phase G: special blocks (not imported as sessions) ---");
  if (data.specialBlocks && data.specialBlocks.length > 0) {
    for (const block of data.specialBlocks) {
      log(
        `  ${block.day}, slot(s) ${block.slots.join(",")}: "${block.label}" (${block.appliesTo ?? "n/a"}) — not inserted; consider posting it as a Notice.`
      );
    }
  } else {
    log("  None.");
  }

  log(`\n=== ${APPLY ? "APPLY COMPLETE" : "DRY RUN COMPLETE — no changes were made"} ===`);
  if (!APPLY) {
    log("Review the plan above. Re-run with --apply to execute it for real.\n");
  } else {
    log("");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
