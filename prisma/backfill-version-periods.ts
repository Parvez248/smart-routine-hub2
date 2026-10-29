import "dotenv/config";
import { getDb } from "../lib/db";
import { parseTimeSlotRange } from "../lib/services/timeslot";

/**
 * Step 52 part D — makes the data that already exists describe itself, so
 * the new version-aware code reads the same routine it read before.
 *
 * Three changes, and deliberately nothing else:
 *  1. the standard period with sortOrder 4 gets `breakAfter = true` — the
 *     break position that used to be hard-coded in labMerge.ts and the grid;
 *  2. every standard period gets `startTime`/`endTime` parsed from its
 *     label, but only where they are still null (the columns are new, so
 *     that is all of them on the first run, and none on a re-run);
 *  3. each existing routine version gets one "Club Activities" SpecialBlock
 *     on Wednesday, covering its post-break periods, `allBatches = true` —
 *     which is exactly what the grid has always drawn from the hard-coded
 *     SPECIAL_BLOCKS list.
 *
 * Dry run by default (prints what it would do, writes nothing); pass
 * --apply to write. Re-running is safe: every change is skipped when it is
 * already in place.
 */
const APPLY = process.argv.includes("--apply");

const BREAK_AFTER_SORT_ORDER = 4;
const CLUB_LABEL = "Club Activities";
const CLUB_DAY = "Wed";

function log(action: string, detail: string) {
  console.log(`${APPLY ? "APPLY " : "DRY   "} ${action.padEnd(22)} ${detail}`);
}

async function main() {
  const db = getDb();

  console.log(APPLY ? "=== APPLYING ===\n" : "=== DRY RUN (pass --apply to write) ===\n");

  // ---- 1 + 2. the standard period set -------------------------------------
  const standard = await db.timeSlot.findMany({
    where: { versionId: null },
    orderBy: { sortOrder: "asc" },
  });
  console.log(`Standard periods (versionId = null): ${standard.length}\n`);

  let breakSet = 0;
  let timesSet = 0;
  let timesUnparseable = 0;

  for (const slot of standard) {
    const shouldBreak = slot.sortOrder === BREAK_AFTER_SORT_ORDER;
    const needsBreak = shouldBreak && !slot.breakAfter;

    // Only ever fill times that are still empty — never overwrite a value
    // someone has already set by hand.
    const range = slot.startTime === null || slot.endTime === null ? parseTimeSlotRange(slot.label) : null;
    const needsTimes = range !== null;
    if ((slot.startTime === null || slot.endTime === null) && range === null) {
      timesUnparseable++;
      log("UNPARSEABLE LABEL", `#${slot.sortOrder} ${JSON.stringify(slot.label)} — times left null`);
    }

    if (!needsBreak && !needsTimes) {
      log("skip (already set)", `#${slot.sortOrder} ${JSON.stringify(slot.label)}`);
      continue;
    }

    const data: { breakAfter?: boolean; startTime?: string; endTime?: string } = {};
    if (needsBreak) data.breakAfter = true;
    if (range) {
      if (slot.startTime === null) data.startTime = range.startTime;
      if (slot.endTime === null) data.endTime = range.endTime;
    }

    log(
      "update period",
      `#${slot.sortOrder} ${JSON.stringify(slot.label)} -> ${JSON.stringify(data)}`
    );
    if (APPLY) await db.timeSlot.update({ where: { id: slot.id }, data });
    if (needsBreak) breakSet++;
    if (range) timesSet++;
  }

  if (!standard.some((s) => s.sortOrder === BREAK_AFTER_SORT_ORDER)) {
    console.log(
      `\n!! No standard period has sortOrder ${BREAK_AFTER_SORT_ORDER}; no break was marked. ` +
        `Set it by hand in Routine -> Versions -> Periods & blocks.`
    );
  }

  // ---- 3. one Club Activities block per existing version -------------------
  console.log();
  const versions = await db.routineVersion.findMany({ orderBy: { id: "asc" } });
  let blocksCreated = 0;

  for (const version of versions) {
    // The block covers the post-break periods of whichever set this version
    // uses — its own if it has any, else the standard set (the same
    // fallback getPeriodsForVersion applies).
    const own = await db.timeSlot.findMany({ where: { versionId: version.id }, orderBy: { sortOrder: "asc" } });
    const periods = own.length > 0 ? own : standard;

    // Read the break from the rows as they will be after step 1 above, so a
    // dry run reports the same block an apply would create.
    const breakAfter = periods.find((p) => p.breakAfter || p.sortOrder === BREAK_AFTER_SORT_ORDER)?.sortOrder ?? null;
    const postBreak = breakAfter === null ? [] : periods.filter((p) => p.sortOrder > breakAfter);

    if (postBreak.length === 0) {
      log("skip version", `${JSON.stringify(version.name)} — no periods after the break`);
      continue;
    }

    const existing = await db.specialBlock.findFirst({
      where: { versionId: version.id, day: CLUB_DAY, label: CLUB_LABEL },
    });
    if (existing) {
      log("skip (block exists)", `${JSON.stringify(version.name)} — ${CLUB_DAY} ${CLUB_LABEL}`);
      continue;
    }

    const fromSlot = postBreak[0].sortOrder;
    const toSlot = postBreak[postBreak.length - 1].sortOrder;
    log("create block", `${JSON.stringify(version.name)} — ${CLUB_DAY} ${CLUB_LABEL}, periods ${fromSlot}-${toSlot}, all batches`);
    if (APPLY) {
      await db.specialBlock.create({
        data: {
          versionId: version.id,
          day: CLUB_DAY,
          fromSlot,
          toSlot,
          label: CLUB_LABEL,
          subLabel: null,
          allBatches: true,
        },
      });
    }
    blocksCreated++;
  }

  console.log(`\n=== SUMMARY (${APPLY ? "applied" : "dry run"}) ===`);
  console.log(`break marked on a period : ${breakSet}`);
  console.log(`periods given start/end  : ${timesSet}`);
  console.log(`labels not parseable     : ${timesUnparseable}`);
  console.log(`special blocks created   : ${blocksCreated}`);
  if (!APPLY) console.log("\nNothing was written. Re-run with --apply.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
