import { bandEdgeClass, bandForBatch, bandVar } from "@/lib/ui/bandColors";
import { sectionLabel } from "@/lib/ui/sections";
import type { FilterableSession } from "./types";

// Every row keeps a band-coloured left edge (batch seniority) — status always
// wins over band colour, so a cancelled/moved class stays visible regardless.
// Used by the table view; the routine bars (RoutineTimeRail) fill solid instead.
export function rowEdgeClass(batch: { semester: string }, cancelled: boolean, moved: boolean): string {
  if (cancelled) return "shadow-[inset_4px_0_0_0_var(--cancelled)]";
  if (moved) return "shadow-[inset_4px_0_0_0_var(--moved)]";
  return bandEdgeClass(bandForBatch(batch));
}

// LAB is filled in the batch's band colour; THEORY is outlined. Shared between
// the table view and the time rail so both read consistently. `onBar` switches
// to a translucent-white treatment for when the pill sits on an already
// solid-coloured bar (band-colour-on-band-colour would be unreadable).
export function TypePill({ type, batch, onBar = false }: { type: string; batch: { semester: string }; onBar?: boolean }) {
  const isLab = type === "LAB";
  const band = bandForBatch(batch);

  if (onBar) {
    return (
      <span
        className={
          isLab
            ? "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/25 text-white print:bg-transparent print:border print:border-foreground print:text-foreground"
            : "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border border-white/60 text-white print:border-foreground print:text-foreground"
        }
      >
        {isLab ? "LAB" : "THEORY"}
      </span>
    );
  }

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

/** Outlined band-coloured pill for a batch, e.g. "23rd / 8th", "26th / 5th · Sec 2", or "28th / 3rd · Sec 1 & 2" for a combined-section class. */
export function BatchPill({ batch, section }: { batch: { name: string; semester: string }; section?: string | null }) {
  const band = bandForBatch(batch);
  const label = sectionLabel(section);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border font-data print:border-foreground print:text-foreground"
      style={{ borderColor: bandVar(band), color: bandVar(band) }}
    >
      {batch.name} / {batch.semester}
      {label ? ` · ${label}` : ""}
    </span>
  );
}

// Course titles are often equal to the code in this data set (no separate
// title was ever provided). Only show a title line when it adds information.
export function courseTitleIfDifferent(course: { code: string; title: string }): string | null {
  const title = course.title?.trim();
  const code = course.code?.trim();
  if (!title) return null;
  if (title.toLowerCase() === (code ?? "").toLowerCase()) return null;
  return title;
}
