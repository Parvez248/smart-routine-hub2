import { bandEdgeClass, bandForBatch, bandVar } from "@/lib/ui/bandColors";
import type { FilterableSession } from "./types";

// Every row keeps a band-coloured left edge (batch seniority) — status always
// wins over band colour, so a cancelled/moved class stays visible regardless.
export function rowEdgeClass(batch: { semester: string }, cancelled: boolean, moved: boolean): string {
  if (cancelled) return "shadow-[inset_4px_0_0_0_var(--cancelled)]";
  if (moved) return "shadow-[inset_4px_0_0_0_var(--moved)]";
  return bandEdgeClass(bandForBatch(batch));
}

// LAB is filled in the batch's band colour; THEORY is outlined. Shared between
// the table view and the time rail so both read consistently.
export function TypePill({ type, batch }: { type: string; batch: { semester: string } }) {
  const isLab = type === "LAB";
  const band = bandForBatch(batch);
  return (
    <span
      className={
        isLab
          ? "on-band inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold print:border print:border-foreground"
          : "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border border-slate text-slate print:border-foreground print:text-foreground"
      }
      style={isLab ? { backgroundColor: bandVar(band), color: "var(--band-1-text)" } : undefined}
    >
      {isLab ? "LAB" : "THEORY"}
    </span>
  );
}

export function formatMovedDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function MovedNote({ movedTo }: { movedTo: FilterableSession["movedTo"] }) {
  if (!movedTo) return null;
  return (
    <div className="mt-1 text-xs font-normal text-moved">
      → {movedTo.date ? `${formatMovedDate(movedTo.date)}, ` : ""}
      {movedTo.day}, {movedTo.timeSlot?.label}, Room {movedTo.room?.name}
    </div>
  );
}

/** Outlined band-coloured pill for a batch, e.g. "23rd / 8th" or "26th / 5th · Sec 2". */
export function BatchPill({ batch, section }: { batch: { name: string; semester: string }; section?: string | null }) {
  const band = bandForBatch(batch);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border font-data print:border-foreground print:text-foreground"
      style={{ borderColor: bandVar(band), color: bandVar(band) }}
    >
      {batch.name} / {batch.semester}
      {section ? ` · Sec ${section}` : ""}
    </span>
  );
}
