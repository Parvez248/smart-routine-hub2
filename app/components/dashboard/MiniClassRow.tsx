import { rowEdgeClass, formatMovedDate } from "@/app/components/routine/RowBadges";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import type { FilterableSession } from "@/app/components/routine/types";

// A compact one-line class item for dashboard lists ("today's classes") —
// time · course · teacher · room, with the same band-colour left edge and
// status badges as the routine table view, so it reads as the same system.
export function MiniClassRow<T extends FilterableSession>({ session }: { session: T }) {
  const cancelled = session.status === "CANCELLED";
  const moved = !cancelled && Boolean(session.movedTo);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0 ${rowEdgeClass(session.batch, cancelled, moved)}`}
    >
      <span className="font-data tabular text-xs text-muted-foreground whitespace-nowrap w-[92px] shrink-0">
        {session.timeSlot.label}
      </span>
      <span className={`font-data font-semibold text-sm shrink-0 ${cancelled ? "line-through text-muted-foreground" : "text-foreground"}`}>
        {session.course.code}
      </span>
      <span className="text-xs text-slate truncate flex-1 min-w-0">
        {session.teacher.initials} · Room {session.room.name}
      </span>
      {cancelled && <StatusBadge status="Cancelled" />}
      {moved && (
        <StatusBadge
          status="Moved"
          className="whitespace-nowrap"
        />
      )}
      {moved && session.movedTo && (
        <span className="hidden sm:inline text-xs text-moved shrink-0">
          → {session.movedTo.date ? `${formatMovedDate(session.movedTo.date)}, ` : ""}{session.movedTo.day}
        </span>
      )}
    </div>
  );
}
