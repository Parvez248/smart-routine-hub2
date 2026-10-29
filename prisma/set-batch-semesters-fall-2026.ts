import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { getDb } from "../lib/db";

/**
 * Step 53 §5 — move every batch up one semester, as Fall 2026 has them.
 *
 * ⚠ DO NOT RUN THIS UNTIL FALL 2026 IS PUBLISHED.
 *
 * A batch has one semester label, shared by every routine. While Spring
 * 2026 is still the published routine, relabelling the 24th as "8th"
 * would mislabel the routine students are actually following — Spring
 * teaches them as the 7th. So the import (Step 53) deliberately leaves
 * the labels alone, and this script moves them in one go afterwards:
 *
 *   1. Routine → Versions → Publish "Fall 2026", with its effective date.
 *   2. npx tsx prisma/set-batch-semesters-fall-2026.ts --apply
 *
 * It reads the same file the import did, so the labels can never drift
 * from the routine they describe. Dry run by default; only `semester` is
 * ever written, and only where it differs. Re-running is safe.
 */
const APPLY = process.argv.includes("--apply");
const DATA_PATH = join(__dirname, "data", "routine-data-fall-2026.json");
const VERSION_NAME = "Fall 2026";

type JsonData = { batches: { name: string; semester: string }[] };

async function main() {
  const data: JsonData = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
  const db = getDb();

  console.log(
    `\n=== Batch semesters for ${VERSION_NAME} — ${APPLY ? "APPLY MODE" : "DRY RUN (pass --apply to write)"} ===\n`
  );

  const version = await db.routineVersion.findUnique({ where: { name: VERSION_NAME } });
  if (!version) {
    console.error(`✗ There is no version named "${VERSION_NAME}". Import it first (prisma/import-fall-2026.ts).\n`);
    process.exit(1);
  }

  // The guard that makes the ordering explicit rather than remembered.
  if (!version.isPublished) {
    console.error(
      `✗ "${VERSION_NAME}" is not published yet (it is a draft).\n\n` +
        `  Batch semester labels are shared by every routine, so moving them now would\n` +
        `  mislabel the routine students are currently following. Publish ${VERSION_NAME}\n` +
        `  first — Routine → Versions → Publish — then run this again.\n`
    );
    process.exit(1);
  }

  let changed = 0;
  let unchanged = 0;
  let missing = 0;

  for (const b of data.batches) {
    const existing = await db.batch.findUnique({ where: { name: b.name } });
    if (!existing) {
      missing++;
      console.log(`  ?  ${b.name.padEnd(6)} not in the database — skipped`);
      continue;
    }
    if (existing.semester === b.semester) {
      unchanged++;
      console.log(`  =  ${b.name.padEnd(6)} already "${b.semester}"`);
      continue;
    }
    changed++;
    console.log(`  ~  ${b.name.padEnd(6)} "${existing.semester}" → "${b.semester}"`);
    if (APPLY) {
      await db.batch.update({ where: { id: existing.id }, data: { semester: b.semester } });
    }
  }

  console.log(`\n  changed: ${changed}   already correct: ${unchanged}   not found: ${missing}`);
  if (!APPLY) console.log("\n  Nothing was written. Re-run with --apply.\n");
  else console.log("\n  Done. Nothing else about these batches was touched.\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
