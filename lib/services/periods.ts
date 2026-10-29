/**
 * "Which periods and special blocks does this routine version use?" — the
 * one place that answers it, so the fallback rule can't be re-implemented
 * (and got slightly wrong) in each caller.
 *
 * The rule: a version uses its own TimeSlot rows if it has any, otherwise
 * the STANDARD set (`versionId = null`). Spring 2026 has no periods of its
 * own, so it keeps using the standard six — which is exactly why Step 52
 * leaves it untouched.
 *
 * The pure rules derived from a period set (lab starts, the break
 * position, whether a block covers a batch) live in lib/ui/periods.ts so
 * client components can use them too.
 */
import { getDb } from "@/lib/db";
import { isValidLabStart, validLabStarts, type Period, type SpecialBlockView } from "@/lib/ui/periods";
import type { SpecialBlockInput } from "@/lib/validation/periods";

const periodSelect = {
  id: true,
  label: true,
  sortOrder: true,
  startTime: true,
  endTime: true,
  breakAfter: true,
} as const;

/** The STANDARD period set — every version that has no periods of its own. */
export async function getStandardPeriods(): Promise<Period[]> {
  const db = getDb();
  return db.timeSlot.findMany({
    where: { versionId: null },
    select: periodSelect,
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * The period set this version schedules against: its own if it has any,
 * else the standard set. `versionId: null` asks for the standard set
 * directly (e.g. the Academic Data → Time Slots editor).
 */
export async function getPeriodsForVersion(versionId: number | null): Promise<Period[]> {
  if (versionId === null) return getStandardPeriods();

  const db = getDb();
  const own = await db.timeSlot.findMany({
    where: { versionId },
    select: periodSelect,
    orderBy: { sortOrder: "asc" },
  });
  return own.length > 0 ? own : getStandardPeriods();
}

/** True when the version has periods of its own (so editing them is safe). */
export async function hasOwnPeriods(versionId: number): Promise<boolean> {
  const db = getDb();
  return (await db.timeSlot.count({ where: { versionId } })) > 0;
}

/** This version's special blocks, with their batches resolved. */
export async function getSpecialBlocks(versionId: number): Promise<SpecialBlockView[]> {
  const db = getDb();
  const blocks = await db.specialBlock.findMany({
    where: { versionId },
    include: {
      // The full batch rows, not just the ids: the grid draws a row for a
      // batch that a block names even when it has no classes that day.
      batches: {
        include: { batch: { select: { id: true, name: true, semester: true, sectionCount: true } } },
      },
    },
    orderBy: [{ day: "asc" }, { fromSlot: "asc" }],
  });
  return blocks.map(({ batches, versionId: _versionId, ...block }) => ({
    ...block,
    batchIds: batches.map((b) => b.batchId),
    batches: batches.map((b) => b.batch),
  }));
}

/**
 * How many sessions use each period of a set, keyed by TimeSlot id — what
 * the editor's "In use by N classes" comes from, and what stops a period
 * that is in use from being removed or renumbered.
 */
export async function getPeriodUsage(periodIds: number[]): Promise<Map<number, number>> {
  const db = getDb();
  if (periodIds.length === 0) return new Map();
  const grouped = await db.session.groupBy({
    by: ["timeSlotId"],
    where: { timeSlotId: { in: periodIds } },
    _count: { _all: true },
  });
  const usage = new Map<number, number>();
  for (const id of periodIds) usage.set(id, 0);
  for (const row of grouped) usage.set(row.timeSlotId, row._count._all);
  return usage;
}

/**
 * Validates a session's period choice against its version's set — the
 * check behind the 400s in POST/PATCH /api/sessions. Returns an error
 * message, or null when the placement is allowed.
 *
 * Two separate things can be wrong: the period may belong to a different
 * version's set entirely (easy to hit by hand-posting an id, or by leaving
 * a stale dialog open after switching version), or it may be a period a
 * two-period lab cannot occupy.
 *
 * The lab rule has to be stated as "is this row part of a valid pair?",
 * not "does this row start one". A two-period lab is stored as TWO Session
 * rows (Step 37/38) and the dialog creates them one after the other, so
 * the second row always lands on `start + 1` — which is usually not itself
 * a valid start. Checking each row in isolation therefore rejected the
 * second half of every legitimate lab, which is what shipped in Step 52
 * and made labs at period 3 or 5 of the standard set impossible to add.
 *
 * So a LAB row is allowed when either:
 *   - its period is a valid lab start, or
 *   - the period before it is a valid start AND the lab's own first row is
 *     already there (`labPartner` describes what "its own first row"
 *     means: same class, same day, same version, one period earlier).
 * A lab on a period that can be neither is still refused.
 */
export type LabPartner = {
  day: string;
  batchId: number;
  section: string | null;
  courseId: number;
  teacherId: number;
  roomId: number;
  /** The row being edited, so it never counts as its own partner. */
  excludeSessionId?: number;
};

export async function checkPeriodForVersion(
  versionId: number,
  timeSlotId: number,
  courseType: "THEORY" | "LAB",
  labPartner?: LabPartner
): Promise<string | null> {
  const periods = await getPeriodsForVersion(versionId);
  const period = periods.find((p) => p.id === timeSlotId);
  if (!period) {
    return "That time slot is not one of this routine version's periods.";
  }

  if (courseType !== "LAB") return null;
  if (isValidLabStart(period.sortOrder, periods)) return null;

  const starts = validLabStarts(periods);
  const previous = periods.find((p) => p.sortOrder === period.sortOrder - 1);
  const isSecondHalf = previous !== undefined && starts.includes(previous.sortOrder);

  if (isSecondHalf && labPartner) {
    const db = getDb();
    const partner = await db.session.findFirst({
      where: {
        versionId,
        timeSlotId: previous.id,
        day: labPartner.day,
        batchId: labPartner.batchId,
        section: labPartner.section,
        courseId: labPartner.courseId,
        teacherId: labPartner.teacherId,
        roomId: labPartner.roomId,
        ...(labPartner.excludeSessionId ? { id: { not: labPartner.excludeSessionId } } : {}),
      },
      select: { id: true },
    });
    if (partner) return null;
  }

  if (starts.length === 0) {
    return "This version has no period a two-period lab can start at.";
  }
  return isSecondHalf
    ? `A lab at period ${period.sortOrder} must be the second half of one starting at period ${previous!.sortOrder}, ` +
        `but that period has no matching first row. Labs start at period ${starts.join(", ")}.`
    : `A lab cannot start at period ${period.sortOrder}. It must start at period ${starts.join(", ")}.`;
}

/**
 * Is this special block a legal one for this version? Shared by POST
 * .../special-blocks and PATCH .../special-blocks/[blockId] so the two
 * can't drift apart. The block must sit inside the version's period range,
 * cover at least one period, and — unless it applies to every batch — name
 * batches that exist. Returns an error message, or null when it is valid.
 */
export async function validateSpecialBlock(
  versionId: number,
  input: SpecialBlockInput
): Promise<string | null> {
  if (input.toSlot < input.fromSlot) {
    return "The block's last period cannot come before its first.";
  }

  const periods = await getPeriodsForVersion(versionId);
  const orders = new Set(periods.map((p) => p.sortOrder));
  if (!orders.has(input.fromSlot) || !orders.has(input.toSlot)) {
    const available = [...orders].sort((a, b) => a - b).join(", ");
    return `Periods ${input.fromSlot}–${input.toSlot} are not both in this version's periods (${available}).`;
  }

  if (!input.allBatches) {
    if (input.batchIds.length === 0) {
      return "Choose at least one batch, or set the block to apply to all batches.";
    }
    const db = getDb();
    const found = await db.batch.count({ where: { id: { in: input.batchIds } } });
    if (found !== new Set(input.batchIds).size) {
      return "One of the chosen batches no longer exists.";
    }
  }

  return null;
}
