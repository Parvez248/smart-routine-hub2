import "dotenv/config";
import { getDb } from "../lib/db";

/**
 * Step 49b — give every pre-existing Exam row a sitting.
 *
 * Exams written before Step 49b only had clock times. An exam starting at
 * 13:00 or later belongs to the afternoon sitting; anything earlier is a
 * morning one. The column's own default is MORNING, so this only has to
 * correct the afternoon rows — but it reports both, so the split can be
 * eyeballed before anything is written.
 *
 * Dry run by default, like every other script in this folder; pass --apply
 * to write. `seats` is deliberately left null: how a batch was split across
 * rooms isn't recorded anywhere, so it can't be inferred, and a null seat
 * count only means "not capacity-checked" (a warning, never a block).
 */
const AFTERNOON_FROM = "13:00";

async function main() {
  const apply = process.argv.includes("--apply");
  const db = getDb();

  const exams = await db.exam.findMany({
    include: { course: true, batch: true },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  // "HH:MM" strings compare correctly with <, both being zero-padded.
  const shouldBeAfternoon = exams.filter((e) => e.startTime >= AFTERNOON_FROM);
  const shouldBeMorning = exams.filter((e) => e.startTime < AFTERNOON_FROM);

  console.log(`${exams.length} exam(s) found.`);
  console.log(`  morning   (starts before ${AFTERNOON_FROM}): ${shouldBeMorning.length}`);
  console.log(`  afternoon (starts ${AFTERNOON_FROM} or later): ${shouldBeAfternoon.length}\n`);

  for (const e of exams) {
    const target = e.startTime >= AFTERNOON_FROM ? "AFTERNOON" : "MORNING";
    const change = e.sitting === target ? "already correct" : `${e.sitting} -> ${target}`;
    console.log(
      `  #${e.id} ${e.course.code} ${e.batch.name} ${e.date.toISOString().slice(0, 10)} ` +
      `${e.startTime}-${e.endTime}  ${change}`
    );
  }

  const needsChange = exams.filter((e) => e.sitting !== (e.startTime >= AFTERNOON_FROM ? "AFTERNOON" : "MORNING"));
  console.log(`\n${needsChange.length} row(s) need updating.`);

  if (!apply) {
    console.log("\nDry run — nothing written. Re-run with --apply to write.");
    return;
  }

  if (needsChange.length === 0) {
    console.log("Nothing to write.");
    return;
  }

  const updated = await db.exam.updateMany({
    where: { id: { in: needsChange.map((e) => e.id) } },
    data: { sitting: "AFTERNOON" },
  });
  console.log(`Updated ${updated.count} row(s) to AFTERNOON.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
