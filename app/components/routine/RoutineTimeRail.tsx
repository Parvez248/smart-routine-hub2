"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { TypePill, BatchPill, MovedNote, rowEdgeClass } from "./RowBadges";
import type { FilterableSession } from "./types";

const DAY_ORDER = ["Sat", "Sun", "Mon", "Tues", "Wed"];
const DAY_NAME: Record<string, string> = { Sat: "Saturday", Sun: "Sunday", Mon: "Monday", Tues: "Tuesday", Wed: "Wednesday" };

function Row<T extends FilterableSession>({ session: s, renderActions }: { session: T; renderActions?: (s: T) => React.ReactNode }) {
  const cancelled = s.status === "CANCELLED";
  const moved = !cancelled && Boolean(s.movedTo);
  const isLab = s.course.type === "LAB";

  return (
    <div
      className={`group bg-card border border-border rounded-md px-3.5 ${isLab ? "py-4" : "py-2.5"} ${rowEdgeClass(s.batch, cancelled, moved)} ${
        cancelled ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`font-semibold font-data text-sm ${cancelled ? "text-muted-foreground line-through" : "text-foreground"}`}>
              {s.course.code}
            </span>
            <TypePill type={s.course.type} batch={s.batch} />
            {cancelled && <StatusBadge status="Cancelled" />}
            {moved && <StatusBadge status="Moved" />}
          </div>
          <p className="text-xs text-slate truncate mt-0.5" title={s.course.title}>{s.course.title}</p>
          <p className="text-xs text-muted-foreground mt-1 font-data">
            {s.teacher.initials} · Room {s.room.name}
          </p>
          {moved && <MovedNote movedTo={s.movedTo} />}
          <div className="mt-1.5">
            <BatchPill batch={s.batch} section={s.section} />
          </div>
        </div>
        {renderActions && <div className="print:hidden shrink-0">{renderActions(s)}</div>}
      </div>
    </div>
  );
}

function DaySkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="p-5 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

export function RoutineTimeRail<T extends FilterableSession>({
  sessions, renderActions, onClearFilters, loading = false,
}: {
  sessions: T[];
  renderActions?: (s: T) => React.ReactNode;
  onClearFilters?: () => void;
  loading?: boolean;
}) {
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  function toggleDay(day: string) {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  const byDay = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const day of DAY_ORDER) map.set(day, []);
    for (const s of sessions) {
      if (!map.has(s.day)) map.set(s.day, []);
      map.get(s.day)!.push(s);
    }
    return map;
  }, [sessions]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <DaySkeleton key={i} />)}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        icon="🔍"
        message="No classes match these filters."
        action={
          onClearFilters ? (
            <button type="button" onClick={onClearFilters} className="text-xs font-semibold text-primary hover:opacity-80">
              Clear all filters
            </button>
          ) : undefined
        }
      />
    );
  }

  const days = [...byDay.keys()].filter((d) => (byDay.get(d) ?? []).length > 0);

  return (
    <div className="space-y-3 p-4">
      {days.map((day) => {
        const daySessions = [...(byDay.get(day) ?? [])].sort((a, b) => a.timeSlot.sortOrder - b.timeSlot.sortOrder);
        const collapsed = collapsedDays.has(day);

        const bySlot = new Map<string, { label: string; sortOrder: number; sessions: T[] }>();
        for (const s of daySessions) {
          const key = s.timeSlot.label;
          if (!bySlot.has(key)) bySlot.set(key, { label: s.timeSlot.label, sortOrder: s.timeSlot.sortOrder, sessions: [] });
          bySlot.get(key)!.sessions.push(s);
        }
        const slots = [...bySlot.values()].sort((a, b) => a.sortOrder - b.sortOrder);

        return (
          <div key={day} className="bg-card border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggleDay(day)}
              aria-expanded={!collapsed}
              className="w-full flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="font-heading text-base font-semibold text-foreground">{DAY_NAME[day] ?? day}</span>
                <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-data">
                  {daySessions.length}
                </span>
              </span>
              <ChevronDown className={`size-4 text-slate transition-transform ${collapsed ? "" : "rotate-180"}`} aria-hidden="true" />
            </button>

            {!collapsed && (
              <div className="border-t border-border px-5 py-4">
                <div className="grid grid-cols-[56px_1fr] gap-x-3">
                  {slots.map((slot) => (
                    <Fragment key={slot.label}>
                      <div className="text-right pt-2.5">
                        <span className="text-[11px] font-data tabular text-muted-foreground whitespace-nowrap">{slot.label}</span>
                      </div>
                      <div className="border-l border-border pl-4 py-2 space-y-2">
                        {slot.sessions.map((s) => (
                          <Row key={s.id} session={s} renderActions={renderActions} />
                        ))}
                      </div>
                    </Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
