"use client";

import { useMemo } from "react";
import { EmptyState } from "@/app/components/ui/EmptyState";
import type { FilterableSession } from "./types";

const DAY_ORDER = ["Sat", "Sun", "Mon", "Tues", "Wed"];

function formatMovedDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
      type === "LAB" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
    }`}>
      {type === "LAB" ? "Lab" : "Theory"}
    </span>
  );
}

function DefaultCard({ session }: { session: FilterableSession }) {
  const cancelled = session.status === "CANCELLED";
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${cancelled ? "border-red-100 bg-red-50/50" : "border-gray-100 bg-gray-50"}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`font-semibold text-gray-800 text-sm ${cancelled ? "line-through text-gray-400" : ""}`}>
          {session.course.code}
        </span>
        <TypeBadge type={session.course.type} />
        {cancelled && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
            Cancelled
          </span>
        )}
      </div>
      <p className={`text-xs text-gray-500 mt-1 ${cancelled ? "line-through text-gray-300" : ""}`}>
        {session.teacher.initials} · {session.batch.name}
        {session.section ? ` · ${session.section}` : ""}
      </p>
      <p className={`text-xs text-gray-500 ${cancelled ? "line-through text-gray-300" : ""}`}>Room {session.room.name}</p>
      {!cancelled && session.movedTo && (
        <p className="text-[11px] text-amber-700 mt-1">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 mr-1">
            {session.movedTo.date ? `Moved on ${formatMovedDate(session.movedTo.date)}` : "Moved"}
          </span>
          to {session.movedTo.day}, {session.movedTo.timeSlot?.label}, Room {session.movedTo.room?.name}
        </p>
      )}
    </div>
  );
}

export function RoutineGrid<T extends FilterableSession>({
  sessions, renderCard, onClearFilters,
}: {
  sessions: T[];
  renderCard?: (s: T) => React.ReactNode;
  onClearFilters?: () => void;
}) {
  const timeSlots = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sessions) map.set(s.timeSlot.label, s.timeSlot.sortOrder);
    return [...map.entries()].sort((a, b) => a[1] - b[1]).map(([label]) => label);
  }, [sessions]);

  const cellFor = (day: string, slotLabel: string) => sessions.filter((s) => s.day === day && s.timeSlot.label === slotLabel);

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon="🔍"
        message="No classes match these filters."
        action={
          onClearFilters ? (
            <button type="button" onClick={onClearFilters} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
              Clear all filters
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wide">
            <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Time Slot</th>
            {DAY_ORDER.map((d) => (
              <th key={d} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {timeSlots.map((slotLabel) => (
            <tr key={slotLabel}>
              <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap align-top">{slotLabel}</td>
              {DAY_ORDER.map((day) => {
                const cellSessions = cellFor(day, slotLabel);
                return (
                  <td key={day} className="px-4 py-3 align-top min-w-[160px]">
                    {cellSessions.length === 0 ? (
                      <span className="text-gray-200">—</span>
                    ) : (
                      <div className="space-y-2">
                        {cellSessions.map((s) => (
                          <div key={s.id}>{renderCard ? renderCard(s) : <DefaultCard session={s} />}</div>
                        ))}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
