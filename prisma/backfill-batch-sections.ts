import "dotenv/config";
import { getDb } from "../lib/db";

/**
 * Step 50 §3 — backfill `Batch.sectionCount` from the section values already
 * in use. A batch that has any session (in ANY version, not just the
 * published one) with section "Sec 1" / "Sec 2" / "Both" is sectioned → 2;
 * every other batch keeps the column default of 1.
 *
 * Writes only `Batch.sectionCount` — never a session's `section` (Step 50
 * part E). Sessions whose section is some other non-null value (e.g. a typo
 * from the free-text box this step removes) are reported for the human to
 * decide on, never rewritten here.
 *
 * Dry run by default, like every write-capable script in this repo; pass
 * --apply to actually write.
 */
const APPLY = process.argv.includes("--apply");

const KNOWN_SECTIONS = ["Sec 1", "Sec 2", "Both"];

async function main() {
  console.log(
    `\n=== Batch sectionCount backfill — ${
      APPLY ? "APPLY MODE (will write to the database)" : "DRY RUN (no changes will be made)"
    } ===\n`
  );

  const db = await getDb();
  const batches = await db.batch.findMany({ orderBy: { name: "asc" } });
  const sessions = await db.session.findMany({
    select: { id: true, batchId: true, section: true, day: true, versionId: true },
  });

  const sectionedBatchIds = new Set<number>();
  const oddValues: { sessionId: number; batchId: number; section: string; versionId: number | null }[] = [];

  for (const s of sessions) {
    const value = s.section?.trim() ?? null;
    if (value === null) continue;
    if (KNOWN_SECTIONS.includes(value)) {
      sectionedBatchIds.add(s.batchId);
    } else {
      oddValues.push({ sessionId: s.id, batchId: s.batchId, section: s.section!, versionId: s.versionId });
    }
  }

  console.log("--- Plan ---");
  let toUpdate = 0;
  for (const b of batches) {
    const planned = sectionedBatchIds.has(b.id) ? 2 : 1;
    const changes = planned !== b.sectionCount;
    if (changes) toUpdate++;
    console.log(
      `  ${b.name.padEnd(6)} ${String(b.sectionCount)} -> ${planned}${changes ? "   (update)" : "   (unchanged)"}`
    );
  }

  console.log(`\n${APPLY ? "Updating" : "Would update"} ${toUpdate} batch(es).`);

  console.log("\n--- Sessions with a non-standard section value (reported only, never changed) ---");
  if (oddValues.length === 0) {
    console.log("  None — every session's section is \"Sec 1\", \"Sec 2\", \"Both\" or null.");
  } else {
    const batchById = new Map(batches.map((b) => [b.id, b.name]));
    for (const o of oddValues) {
      console.log(
        `  session ${o.sessionId} (batch ${batchById.get(o.batchId) ?? o.batchId}, version ${o.versionId}): ${JSON.stringify(o.section)}`
      );
    }
    console.log("  ACTION FOR THE HUMAN: decide what these should be; this script never rewrites them.");
  }

  if (APPLY) {
    for (const b of batches) {
      const planned = sectionedBatchIds.has(b.id) ? 2 : 1;
      if (planned !== b.sectionCount) {
        await db.batch.update({ where: { id: b.id }, data: { sectionCount: planned } });
      }
    }
    console.log("\n=== APPLY COMPLETE ===");
    const after = await db.batch.findMany({ orderBy: { name: "asc" }, select: { name: true, sectionCount: true } });
    console.log("Final values:", after.map((b) => `${b.name}=${b.sectionCount}`).join(", "));
  } else {
    console.log("\n=== DRY RUN COMPLETE — no changes were made ===");
    console.log("Re-run with --apply to execute this plan.\n");
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
