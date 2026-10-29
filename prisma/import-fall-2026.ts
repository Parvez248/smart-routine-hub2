import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { getDb } from "../lib/db";
import { sectionsIntersect, isValidSectionFor } from "../lib/ui/sections";
import { validLabStarts, breakAfterSortOrder, type Period } from "../lib/ui/periods";
import { checkConflict, checkCapacity } from "../lib/services/scheduling";
import { checkPeriodForVersion } from "../lib/services/periods";

/**
 * Step 53 — load the Fall 2026 routine into a new, UNPUBLISHED version.
 *
 * Unlike the Step 31 import this one is strictly additive: it never deletes
 * or replaces a session, and the only existing rows it may touch are listed
 * in ALLOWED UPDATES below. Spring 2026 stays published and untouched —
 * which is possible at all because Step 52 made periods and special blocks
 * belong to a version, so Fall's five 1h15 periods can sit beside Spring's
 * six 1-hour ones.
 *
 * ALLOWED UPDATES to existing rows (each one is reported):
 *   - Course.type, and only when that course has no sessions anywhere;
 *   - Batch.sectionCount, where the JSON says 2 and the row says 1.
 * Everything else about an existing row — a teacher's name or login, a
 * course title, a room's capacity, a batch's semester label or student
 * count — is left exactly as it is. Semester labels in particular move up
 * only when Fall is published; that is prisma/set-batch-semesters-fall-2026.ts.
 *
 *   npx tsx prisma/import-fall-2026.ts            # dry run, writes nothing
 *   npx tsx prisma/import-fall-2026.ts --apply    # one transaction, all or nothing
 */
const APPLY = process.argv.includes("--apply");

const VERSION_NAME = "Fall 2026";
const DATA_PATH = join(__dirname, "data", "routine-data-fall-2026.json");

/** Session.day stores these exact strings, and so does the JSON. */
const DAYS = ["Sat", "Sun", "Mon", "Tues", "Wed"] as const;
type Day = (typeof DAYS)[number];

type JsonTimeSlot = { sortOrder: number; label: string; startTime: string; endTime: string; breakAfter: boolean };
type JsonSpecialBlock = { day: string; label: string; subLabel?: string | null; slots: number[]; batches: string[] };
type JsonCourse = { code: string; title: string | null; type: "THEORY" | "LAB" };
type JsonBatch = { name: string; semester: string; sectionCount: number };
type JsonSession = {
  day: string;
  batch: string;
  section: string | null;
  slots: number[];
  course: string;
  teacher: string;
  room: string;
};
type JsonData = {
  term: string;
  effectiveDate: string | null;
  days: string[];
  timeSlots: JsonTimeSlot[];
  validLabStarts: number[];
  specialBlocks: JsonSpecialBlock[];
  teachers: Record<string, string | null>;
  courses: JsonCourse[];
  rooms: string[];
  batches: JsonBatch[];
  sessions: JsonSession[];
  notesForReview?: string[];
  summary: { entries: number; periodRows: number; twoPeriodLabs: number; bothSections: number; conflictsFound: number };
};

const data: JsonData = JSON.parse(readFileSync(DATA_PATH, "utf-8"));

const log = (...args: unknown[]) => console.log(...args);
function section(title: string) {
  log(`\n${"─".repeat(72)}\n${title}\n${"─".repeat(72)}`);
}

/** Aborts the whole run before anything is written. */
class Abort extends Error {}
function abort(reason: string): never {
  throw new Abort(reason);
}

/** One Session row to be inserted — one per period, so a lab is two rows. */
type PlannedRow = {
  day: Day;
  slot: number;
  batch: string;
  section: string | null;
  course: string;
  teacher: string;
  room: string;
};

async function main() {
  log(
    `\n=== Routine Management System — Fall 2026 import — ${
      APPLY ? "APPLY MODE (writes, in one transaction)" : "DRY RUN (writes nothing)"
    } ===`
  );
  log(`Source: ${DATA_PATH}`);

  const db = getDb();

  // =====================================================================
  // Preflight — every check runs in both modes. Anything wrong here stops
  // the run before a single row is written.
  // =====================================================================
  section("1. Preflight — the file describes itself correctly");

  const entries = data.sessions.length;
  const plannedRows: PlannedRow[] = [];
  for (const s of data.sessions) {
    if (!DAYS.includes(s.day as Day)) abort(`Session day "${s.day}" is not one of ${DAYS.join(", ")}.`);
    for (const slot of s.slots) {
      plannedRows.push({
        day: s.day as Day,
        slot,
        batch: s.batch,
        section: s.section,
        course: s.course,
        teacher: s.teacher,
        room: s.room,
      });
    }
  }
  const twoPeriodLabs = data.sessions.filter((s) => s.slots.length === 2).length;
  const bothSections = data.sessions.filter((s) => s.section === "Both").length;

  const counted = { entries, periodRows: plannedRows.length, twoPeriodLabs, bothSections };
  for (const [key, value] of Object.entries(counted)) {
    const expected = data.summary[key as keyof typeof counted];
    const ok = value === expected;
    log(`  ${key.padEnd(14)} counted ${String(value).padStart(4)}   file says ${String(expected).padStart(4)}   ${ok ? "OK" : "MISMATCH"}`);
    if (!ok) abort(`The file's summary.${key} (${expected}) does not match what the script counts (${value}).`);
  }

  // The periods, as Step 52 models them — used for the lab-start rule.
  const periods: Period[] = data.timeSlots.map((t) => ({
    id: -t.sortOrder,
    label: t.label,
    sortOrder: t.sortOrder,
    startTime: t.startTime,
    endTime: t.endTime,
    breakAfter: t.breakAfter,
  }));
  const starts = validLabStarts(periods);
  log(`\n  periods: ${periods.length}, break after ${breakAfterSortOrder(periods)}, lab starts ${starts.join(", ")}`);
  if (JSON.stringify(starts) !== JSON.stringify(data.validLabStarts)) {
    abort(`The file's validLabStarts ${JSON.stringify(data.validLabStarts)} disagrees with the period set's ${JSON.stringify(starts)}.`);
  }

  const slotOrders = new Set(periods.map((p) => p.sortOrder));
  for (const s of data.sessions) {
    const where = `${s.day} ${s.batch} ${s.course}`;
    if (s.slots.length !== 1 && s.slots.length !== 2) abort(`${where}: an entry must cover 1 or 2 periods, not ${s.slots.length}.`);
    for (const slot of s.slots) if (!slotOrders.has(slot)) abort(`${where}: period ${slot} is not in this routine's period set.`);
    if (s.slots.length === 2) {
      if (s.slots[1] !== s.slots[0] + 1) abort(`${where}: a two-period lab must cover consecutive periods (got ${s.slots.join(", ")}).`);
      if (!starts.includes(s.slots[0])) abort(`${where}: a lab cannot start at period ${s.slots[0]} — valid starts are ${starts.join(", ")}.`);
    }
  }
  log(`  every two-period entry starts at ${starts.join(", ")} and covers consecutive periods — OK`);

  // Sections must match each batch's own sectionCount, the same rule the
  // session API enforces (Step 50).
  const sectionCountByBatch = new Map(data.batches.map((b) => [b.name, b.sectionCount]));
  for (const s of data.sessions) {
    const sc = sectionCountByBatch.get(s.batch);
    if (sc === undefined) abort(`Session references batch "${s.batch}", which the file does not declare.`);
    if (!isValidSectionFor(sc, s.section)) {
      abort(`${s.day} ${s.batch} ${s.course}: section ${JSON.stringify(s.section)} is invalid for a batch with ${sc} section(s).`);
    }
  }
  log(`  every entry's section matches its batch's sectionCount — OK`);

  // Referential integrity inside the file.
  const declaredCourses = new Set(data.courses.map((c) => c.code));
  const declaredTeachers = new Set(Object.keys(data.teachers));
  const declaredRooms = new Set(data.rooms);
  for (const s of data.sessions) {
    if (!declaredCourses.has(s.course)) abort(`Session references course "${s.course}", which the file does not declare.`);
    if (!declaredTeachers.has(s.teacher)) abort(`Session references teacher "${s.teacher}", which the file does not declare.`);
    if (!declaredRooms.has(s.room)) abort(`Session references room "${s.room}", which the file does not declare.`);
  }
  log(`  every course, teacher, room and batch a session names is declared — OK`);

  // ---------------------------------------------------------------------
  section("2. Preflight — conflicts within the Fall 2026 routine");

  // The same three rules checkConflict applies (room, teacher, and batch
  // with overlapping sections), run in memory because none of these rows
  // exist yet. After the import, the app's own checkConflict is run against
  // the real rows as well — see step 8.
  const conflicts: string[] = [];
  const byDaySlot = new Map<string, PlannedRow[]>();
  for (const row of plannedRows) {
    const key = `${row.day} period ${row.slot}`;
    if (!byDaySlot.has(key)) byDaySlot.set(key, []);
    byDaySlot.get(key)!.push(row);
  }
  for (const [key, group] of byDaySlot) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i];
        const b = group[j];
        if (a.room === b.room) conflicts.push(`${key}: room ${a.room} — ${a.batch} ${a.course} vs ${b.batch} ${b.course}`);
        if (a.teacher === b.teacher) conflicts.push(`${key}: teacher ${a.teacher} — ${a.batch} ${a.course} vs ${b.batch} ${b.course}`);
        if (a.batch === b.batch && sectionsIntersect(a.section, b.section)) {
          conflicts.push(`${key}: batch ${a.batch} — ${a.course} (${a.section ?? "no section"}) vs ${b.course} (${b.section ?? "no section"})`);
        }
      }
    }
  }
  if (conflicts.length > 0) {
    conflicts.forEach((c) => log(`  ✗ ${c}`));
    abort(`${conflicts.length} conflict(s) in the source data. Nothing was written.`);
  }
  log(`  ${plannedRows.length} rows, 0 conflicts (room, teacher, batch+section) — OK`);

  // ---------------------------------------------------------------------
  section("3. Preflight — the database is ready for this import");

  const existingVersion = await db.routineVersion.findUnique({ where: { name: VERSION_NAME } });
  if (existingVersion) {
    abort(
      `A version named "${VERSION_NAME}" already exists (id ${existingVersion.id}). ` +
        `This import only ever creates a new version; delete or rename the existing one first.`
    );
  }
  log(`  no version named "${VERSION_NAME}" exists — OK`);

  const published = await db.routineVersion.findFirst({ where: { isPublished: true } });
  log(`  currently published: ${published ? `"${published.name}" (id ${published.id})` : "none"} — will not be touched`);

  // =====================================================================
  // Plan
  // =====================================================================
  section("4. Plan — reference data");

  const [dbTeachers, dbRooms, dbCourses, dbBatches] = await Promise.all([
    db.teacher.findMany(),
    db.room.findMany(),
    db.course.findMany(),
    db.batch.findMany(),
  ]);
  const teacherByInitials = new Map(dbTeachers.map((t) => [t.initials, t]));
  const roomByName = new Map(dbRooms.map((r) => [r.name, r]));
  const courseByCode = new Map(dbCourses.map((c) => [c.code, c]));
  const batchByName = new Map(dbBatches.map((b) => [b.name, b]));

  // --- teachers ---------------------------------------------------------
  // A missing teacher is created with the file's name; where the PDF gave
  // none, the initials stand in so the row is findable in Academic Data.
  const newTeachers = Object.entries(data.teachers)
    .filter(([initials]) => !teacherByInitials.has(initials))
    .map(([initials, name]) => ({ initials, name: name ?? initials, namedInPdf: name !== null }));
  log(`  teachers to create: ${newTeachers.length}`);
  for (const t of newTeachers) {
    log(`    + ${t.initials.padEnd(5)} "${t.name}"${t.namedInPdf ? "" : "   ← no name in the PDF; initials used, fill in later"}`);
  }
  const existingTeacherCount = Object.keys(data.teachers).length - newTeachers.length;
  log(`  teachers already present (names left untouched): ${existingTeacherCount}`);

  // --- rooms ------------------------------------------------------------
  // New rooms get the capacity the rest of the rooms use, so one odd room
  // doesn't silently fail capacity checks later.
  const capacities = dbRooms.map((r) => r.capacity);
  const defaultCapacity = capacities.length > 0 ? mode(capacities) : 40;
  const newRooms = data.rooms.filter((name) => !roomByName.has(name));
  log(`\n  rooms to create: ${newRooms.length}${newRooms.length ? ` (capacity ${defaultCapacity}, the usual for this department)` : ""}`);
  newRooms.forEach((r) => log(`    + Room ${r}`));
  log(`  rooms already present (capacities left untouched): ${data.rooms.length - newRooms.length}`);

  // --- courses ----------------------------------------------------------
  const newCourses = data.courses.filter((c) => !courseByCode.has(c.code));
  log(`\n  courses to create: ${newCourses.length}`);
  for (const c of newCourses) {
    log(`    + ${c.code.padEnd(12)} ${c.type.padEnd(6)} "${c.title ?? c.code}"${c.title === null ? "   ← no title in the PDF; code used, fill in later" : ""}`);
  }
  log(`  courses already present (titles left untouched): ${data.courses.length - newCourses.length}`);

  // A course whose type differs may only be corrected while nothing else
  // depends on it; otherwise it would silently turn an existing routine's
  // theory class into a two-period lab (or back).
  const typeChanges: { code: string; from: string; to: string; id: number }[] = [];
  const typeConflictsLeftAlone: string[] = [];
  for (const c of data.courses) {
    const existing = courseByCode.get(c.code);
    if (!existing || existing.type === c.type) continue;
    const [sessionCount, examCount] = await Promise.all([
      db.session.count({ where: { courseId: existing.id } }),
      db.exam.count({ where: { courseId: existing.id } }),
    ]);
    if (sessionCount === 0 && examCount === 0) {
      typeChanges.push({ code: c.code, from: existing.type, to: c.type, id: existing.id });
    } else {
      typeConflictsLeftAlone.push(
        `${c.code}: stored as ${existing.type}, Fall 2026 uses it as ${c.type}, but it has ${sessionCount} class(es) and ${examCount} exam(s) — left as ${existing.type}`
      );
    }
  }
  log(`\n  ALLOWED UPDATE — course type corrections: ${typeChanges.length}`);
  typeChanges.forEach((t) => log(`    ~ ${t.code}: ${t.from} → ${t.to} (no classes or exams use it)`));
  if (typeConflictsLeftAlone.length > 0) {
    log(`  ⚠ type differences left alone — ASK THE HUMAN:`);
    typeConflictsLeftAlone.forEach((t) => log(`      ${t}`));
  }

  // --- batches ----------------------------------------------------------
  const newBatches = data.batches.filter((b) => !batchByName.has(b.name));
  log(`\n  batches to create: ${newBatches.length}`);
  newBatches.forEach((b) => log(`    + ${b.name} — ${b.semester} semester, ${b.sectionCount} section(s)`));

  const sectionCountChanges = data.batches
    .map((b) => ({ json: b, existing: batchByName.get(b.name) }))
    .filter((x) => x.existing && x.existing.sectionCount !== x.json.sectionCount)
    .map((x) => ({ name: x.json.name, from: x.existing!.sectionCount, to: x.json.sectionCount, id: x.existing!.id }));
  log(`  ALLOWED UPDATE — batch sectionCount changes: ${sectionCountChanges.length}`);
  sectionCountChanges.forEach((b) => log(`    ~ ${b.name}: ${b.from} → ${b.to} section(s)`));

  log(`\n  semester labels: NOT changed by this import (they move up only when Fall 2026 is published —`);
  log(`    run prisma/set-batch-semesters-fall-2026.ts then). Current vs Fall:`);
  for (const b of data.batches) {
    const existing = batchByName.get(b.name);
    log(
      existing
        ? `      ${b.name.padEnd(5)} stays "${existing.semester}"   (Fall will be "${b.semester}")`
        : `      ${b.name.padEnd(5)} new, created as "${b.semester}"`
    );
  }

  // ---------------------------------------------------------------------
  section("5. Plan — the version, its periods and its Club Activities block");

  log(`  + RoutineVersion "${VERSION_NAME}" — unpublished, no effective date`);
  log(`  + ${data.timeSlots.length} periods of its own:`);
  for (const t of data.timeSlots) {
    log(`      ${t.sortOrder}. ${t.label.padEnd(20)} ${t.startTime}–${t.endTime}${t.breakAfter ? "   ← break after this period" : ""}`);
  }
  for (const block of data.specialBlocks) {
    const from = Math.min(...block.slots);
    const to = Math.max(...block.slots);
    log(`  + SpecialBlock "${block.label}" — ${block.day}, periods ${from}–${to}, batches ${block.batches.join(", ")}`);
    if (block.subLabel) log(`      sub-label: "${block.subLabel}"`);
    for (const name of block.batches) {
      if (!sectionCountByBatch.has(name)) abort(`Special block names batch "${name}", which the file does not declare.`);
    }
  }
  log(`  + ${plannedRows.length} sessions (${entries} entries, ${twoPeriodLabs} of them two-period labs)`);

  // ---------------------------------------------------------------------
  section("6. Plan — session shape");

  const perDay = new Map<string, number>();
  const perBatch = new Map<string, number>();
  for (const row of plannedRows) {
    perDay.set(row.day, (perDay.get(row.day) ?? 0) + 1);
    perBatch.set(row.batch, (perBatch.get(row.batch) ?? 0) + 1);
  }
  log(`  per day:    ${DAYS.map((d) => `${d}=${perDay.get(d) ?? 0}`).join("   ")}`);
  log(
    `  per batch:  ${[...perBatch.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([b, n]) => `${b}=${n}`).join("   ")}`
  );
  log(`  two-period labs: ${twoPeriodLabs}    classes for both sections: ${bothSections}`);

  if (data.notesForReview?.length) {
    log(`\n  Notes to confirm with the department:`);
    data.notesForReview.forEach((n) => log(`    • ${n}`));
  }

  if (!APPLY) {
    section("DRY RUN COMPLETE — nothing was written");
    log("  Review the plan above, then re-run with --apply.\n");
    return;
  }

  // =====================================================================
  // Apply — one transaction, all or nothing
  // =====================================================================
  section("7. Applying — one transaction");

  const result = await db.$transaction(
    async (tx) => {
      const version = await tx.routineVersion.create({
        data: { name: VERSION_NAME, isPublished: false, effectiveDate: null },
      });

      await tx.timeSlot.createMany({
        data: data.timeSlots.map((t) => ({
          versionId: version.id,
          label: t.label,
          sortOrder: t.sortOrder,
          startTime: t.startTime,
          endTime: t.endTime,
          breakAfter: t.breakAfter,
        })),
      });
      const periodRows = await tx.timeSlot.findMany({ where: { versionId: version.id } });
      const timeSlotIdBySortOrder = new Map(periodRows.map((p) => [p.sortOrder, p.id]));

      for (const t of newTeachers) {
        await tx.teacher.create({ data: { initials: t.initials, name: t.name } });
      }
      for (const name of newRooms) {
        await tx.room.create({ data: { name, capacity: defaultCapacity } });
      }
      for (const c of newCourses) {
        await tx.course.create({ data: { code: c.code, title: c.title ?? c.code, type: c.type } });
      }
      for (const b of newBatches) {
        await tx.batch.create({
          data: { name: b.name, semester: b.semester, sectionCount: b.sectionCount, studentCount: 0 },
        });
      }
      for (const t of typeChanges) {
        await tx.course.update({ where: { id: t.id }, data: { type: t.to as "THEORY" | "LAB" } });
      }
      for (const b of sectionCountChanges) {
        await tx.batch.update({ where: { id: b.id }, data: { sectionCount: b.to } });
      }

      // Re-read the id maps so newly created rows are included.
      const [allTeachers, allRooms, allCourses, allBatches] = await Promise.all([
        tx.teacher.findMany({ select: { id: true, initials: true } }),
        tx.room.findMany({ select: { id: true, name: true } }),
        tx.course.findMany({ select: { id: true, code: true } }),
        tx.batch.findMany({ select: { id: true, name: true } }),
      ]);
      const teacherId = new Map(allTeachers.map((t) => [t.initials, t.id]));
      const roomId = new Map(allRooms.map((r) => [r.name, r.id]));
      const courseId = new Map(allCourses.map((c) => [c.code, c.id]));
      const batchId = new Map(allBatches.map((b) => [b.name, b.id]));

      for (const block of data.specialBlocks) {
        await tx.specialBlock.create({
          data: {
            versionId: version.id,
            day: block.day,
            fromSlot: Math.min(...block.slots),
            toSlot: Math.max(...block.slots),
            label: block.label,
            subLabel: block.subLabel ?? null,
            allBatches: false,
            batches: {
              create: block.batches.map((name) => {
                const id = batchId.get(name);
                if (id === undefined) throw new Error(`Special block batch "${name}" was not created.`);
                return { batchId: id };
              }),
            },
          },
        });
      }

      const sessionData = plannedRows.map((row) => {
        const ids = {
          timeSlotId: timeSlotIdBySortOrder.get(row.slot),
          batchId: batchId.get(row.batch),
          courseId: courseId.get(row.course),
          teacherId: teacherId.get(row.teacher),
          roomId: roomId.get(row.room),
        };
        for (const [field, value] of Object.entries(ids)) {
          if (value === undefined) throw new Error(`${row.day} period ${row.slot} ${row.batch} ${row.course}: ${field} could not be resolved.`);
        }
        return {
          day: row.day,
          timeSlotId: ids.timeSlotId!,
          batchId: ids.batchId!,
          section: row.section,
          courseId: ids.courseId!,
          teacherId: ids.teacherId!,
          roomId: ids.roomId!,
          versionId: version.id,
          status: "ACTIVE",
        };
      });
      await tx.session.createMany({ data: sessionData });

      const inserted = await tx.session.count({ where: { versionId: version.id } });
      if (inserted !== plannedRows.length) {
        throw new Error(`Inserted ${inserted} sessions but planned ${plannedRows.length} — rolling back.`);
      }

      return { versionId: version.id, inserted };
    },
    // Generous, because this is one round trip per reference row over a
    // cloud database; the defaults (2s/5s) are far too short for it.
    { maxWait: 60_000, timeout: 180_000 }
  );

  log(`  committed: version id ${result.versionId}, ${result.inserted} sessions`);

  // =====================================================================
  // Post-apply verification with the app's own checks
  // =====================================================================
  section("8. Verifying with the app's own conflict, period and capacity checks");

  const imported = await db.session.findMany({
    where: { versionId: result.versionId },
    include: { course: true, batch: true, room: true, teacher: true, timeSlot: true },
  });

  const problems: string[] = [];
  const capacityWarnings: string[] = [];

  for (const s of imported) {
    const conflict = await checkConflict({
      day: s.day,
      timeSlotId: s.timeSlotId,
      batchId: s.batchId,
      section: s.section,
      teacherId: s.teacherId,
      roomId: s.roomId,
      versionId: result.versionId,
      excludeSessionId: s.id,
    });
    if (!conflict.ok) {
      problems.push(`${s.day} period ${s.timeSlot.sortOrder} ${s.batch.name} ${s.course.code}: ${conflict.reason}`);
    }

    // The same identity the API passes, so the second row of a two-period
    // lab can find its own first row (see checkPeriodForVersion).
    const periodError = await checkPeriodForVersion(result.versionId, s.timeSlotId, s.course.type, {
      day: s.day,
      batchId: s.batchId,
      section: s.section,
      courseId: s.courseId,
      teacherId: s.teacherId,
      roomId: s.roomId,
      excludeSessionId: s.id,
    });
    if (periodError) {
      problems.push(`${s.day} period ${s.timeSlot.sortOrder} ${s.batch.name} ${s.course.code}: ${periodError}`);
    }

    // Capacity is reported, never enforced: real room capacities and batch
    // sizes have not been entered yet, so a failure here says nothing.
    const capacity = await checkCapacity(s.roomId, s.batchId);
    if (!capacity.ok) {
      capacityWarnings.push(`${s.day} period ${s.timeSlot.sortOrder} ${s.batch.name} in Room ${s.room.name}: ${capacity.reason}`);
    }
  }

  if (problems.length > 0) {
    log(`  ✗ ${problems.length} problem(s) found after the import:`);
    problems.slice(0, 20).forEach((p) => log(`      ${p}`));
    if (problems.length > 20) log(`      … and ${problems.length - 20} more`);

    // Undo everything this run created, not just the version: the
    // transaction has already committed by the time these checks run, so
    // "rolling back" here means deleting it all by hand. Each reference
    // row is only removed if nothing has come to depend on it, so a row
    // that was already in use is never taken away.
    log(`\n  Rolling back everything this run created…`);
    await db.session.deleteMany({ where: { versionId: result.versionId } });
    await db.routineVersion.delete({ where: { id: result.versionId } });
    log(`    removed the version, its periods, its special block and its sessions`);

    for (const t of newTeachers) {
      const row = await db.teacher.findUnique({ where: { initials: t.initials } });
      if (!row || row.userId !== null) continue;
      if ((await db.session.count({ where: { teacherId: row.id } })) === 0) {
        await db.teacher.delete({ where: { id: row.id } });
      }
    }
    for (const name of newRooms) {
      const row = await db.room.findUnique({ where: { name } });
      if (!row) continue;
      const [uses, exams] = await Promise.all([
        db.session.count({ where: { roomId: row.id } }),
        db.examRoom.count({ where: { roomId: row.id } }),
      ]);
      if (uses === 0 && exams === 0) await db.room.delete({ where: { id: row.id } });
    }
    for (const c of newCourses) {
      const row = await db.course.findUnique({ where: { code: c.code } });
      if (!row) continue;
      const [uses, exams] = await Promise.all([
        db.session.count({ where: { courseId: row.id } }),
        db.exam.count({ where: { courseId: row.id } }),
      ]);
      if (uses === 0 && exams === 0) await db.course.delete({ where: { id: row.id } });
    }
    for (const b of newBatches) {
      const row = await db.batch.findUnique({ where: { name: b.name } });
      if (!row) continue;
      const [uses, exams, blocks, students] = await Promise.all([
        db.session.count({ where: { batchId: row.id } }),
        db.exam.count({ where: { batchId: row.id } }),
        db.specialBlockBatch.count({ where: { batchId: row.id } }),
        db.student.count({ where: { batchId: row.id } }),
      ]);
      if (uses === 0 && exams === 0 && blocks === 0 && students === 0) {
        await db.batch.delete({ where: { id: row.id } });
      }
    }
    log(`    removed the teachers, rooms, courses and batches it had created`);
    log(`  NOTE: the allowed updates (course types, batch sectionCounts) are NOT reverted —`);
    log(`    there were ${typeChanges.length} and ${sectionCountChanges.length} of them in this run.`);
    abort(`The import was rolled back. ${problems.length} problem(s) — see above.`);
  }
  log(`  ${imported.length}/${imported.length} sessions pass the app's own checkConflict — 0 conflicts`);
  log(`  ${imported.length}/${imported.length} sessions sit on a period of this version, labs on a valid start`);
  log(
    capacityWarnings.length === 0
      ? `  capacity: no warnings`
      : `  capacity: ${capacityWarnings.length} warning(s) (reported only, never blocking):`
  );
  capacityWarnings.slice(0, 10).forEach((w) => log(`      ${w}`));

  section("APPLY COMPLETE");
  log(`  "${VERSION_NAME}" is in the database as an UNPUBLISHED draft (id ${result.versionId}).`);
  log(`  Spring 2026 is still the published routine.`);
  log(`  Review it under Routine → Schedule → Fall 2026, then publish it when the semester starts.\n`);
}

/** The most common value — used for "the capacity rooms here normally have". */
function mode(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    if (e instanceof Abort) {
      console.error(`\n✗ ABORTED: ${e.message}\n`);
    } else {
      console.error(e);
    }
    process.exit(1);
  });
