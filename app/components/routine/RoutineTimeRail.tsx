"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Pencil, Trash2, Plus } from "lucide-react";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { bandForBatch, bandVar } from "@/lib/ui/bandColors";
import { TypePill, BatchPill, MovedNote, courseTitleIfDifferent } from "./RowBadges";
import type { FilterableSession } from "./types";
import type { AddSessionContext } from "./RoutineGrid";

const DAY_ORDER = ["Sat", "Sun", "Mon", "Tues", "Wed"];
const DAY_NAME: Record<string, string> = { Sat: "Saturday", Sun: "Sunday", Mon: "Monday", Tues: "Tuesday", Wed: "Wednesday" };

// A full-width, solidly-filled bar in the batch's band colour (status colour
// overrides band colour when cancelled/moved) with white text — the page's
// signature element. `.on-band` neutralises the fill/text for print, where
// bars must stay black-and-white with the same [Cancelled]/[Moved → …] labels.
function Bar<T extends FilterableSession>({
  session: s, renderActions, editable, onEditSession, onDeleteSession,
}: {
  session: T;
  renderActions?: (s: T) => React.ReactNode;
  editable?: boolean;
  onEditSession?: (session: T) => void;
  onDeleteSession?: (session: T) => void;
}) {
  const cancelled = s.status === "CANCELLED";
  const moved = !cancelled && Boolean(s.movedTo);
  const band = bandForBatch(s.batch);
  const fill = cancelled ? "var(--bar-cancelled)" : moved ? "var(--bar-moved)" : bandVar(band);
  const title = courseTitleIfDifferent(s.course);

  return (
    <div
      className="on-band rounded-lg px-4 py-2.5 flex items-start justify-between gap-3 print:border print:border-foreground"
      style={{ backgroundColor: fill }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-white text-sm">
          <span className="font-data tabular font-semibold whitespace-nowrap">{s.timeSlot.label}</span>
          <span className="text-white/60">·</span>
          <span className={`font-data font-bold ${cancelled ? "line-through" : ""}`}>{s.course.code}</span>
          <span className="text-white/60">·</span>
          <span className="font-data">{s.teacher.initials}</span>
          <span className="text-white/60">·</span>
          <span className="font-data">Room {s.room.name}</span>
          <TypePill type={s.course.type} batch={s.batch} onBar />
          {cancelled && <StatusBadge status="Cancelled" />}
          {moved && <StatusBadge status="Moved" />}
        </div>
        {title && <p className="text-xs text-white/80 mt-0.5 truncate">{title}</p>}
        {moved && <MovedNote movedTo={s.movedTo} />}
      </div>
      {renderActions && <div className="print:hidden shrink-0">{renderActions(s)}</div>}
      {editable && (
        <div className="print:hidden shrink-0 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/bar:opacity-100 sm:focus-within:opacity-100 transition-opacity">
          {onEditSession && (
            <button
              type="button"
              onClick={() => onEditSession(s)}
              className="p-1.5 rounded bg-white/25 hover:bg-white/40 text-white"
              aria-label={`Edit ${s.course.code}`}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </button>
          )}
          {onDeleteSession && (
            <button
              type="button"
              onClick={() => onDeleteSession(s)}
              className="p-1.5 rounded bg-white/25 hover:bg-white/40 text-white"
              aria-label={`Delete ${s.course.code}`}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DaySkeleton() {
  return (
    <div className="glass rounded-lg overflow-hidden">
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
  editable = false, onEditSession, onDeleteSession, onAddSession,
}: {
  sessions: T[];
  renderActions?: (s: T) => React.ReactNode;
  onClearFilters?: () => void;
  loading?: boolean;
  editable?: boolean;
  onEditSession?: (session: T) => void;
  onDeleteSession?: (session: T) => void;
  onAddSession?: (ctx: AddSessionContext<T>) => void;
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
      <div className="space-y-4 p-4">
        {Array.from({ length: 3 }).map((_, i) => <DaySkeleton key={i} />)}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="glass rounded-lg overflow-hidden">
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
      </div>
    );
  }

  const days = [...byDay.keys()].filter((d) => (byDay.get(d) ?? []).length > 0);

  return (
    <div className="space-y-4 p-4">
      {days.map((day) => {
        const daySessions = [...(byDay.get(day) ?? [])];
        const collapsed = collapsedDays.has(day);

        // Group by batch (+ section) within the day — a batch chip, then that
        // batch's bars sorted by time slot, sitting on a white card.
        const byBatch = new Map<string, { batch: T["batch"]; section: T["section"]; sortKey: number; sessions: T[] }>();
        for (const s of daySessions) {
          const key = `${s.batch.name}|${s.batch.semester}|${s.section ?? ""}`;
          if (!byBatch.has(key)) {
            const n = parseInt(s.batch.semester.match(/\d+/)?.[0] ?? "0", 10);
            byBatch.set(key, { batch: s.batch, section: s.section, sortKey: n, sessions: [] });
          }
          byBatch.get(key)!.sessions.push(s);
        }
        const batchGroups = [...byBatch.values()]
          .map((g) => ({ ...g, sessions: g.sessions.sort((a, b) => a.timeSlot.sortOrder - b.timeSlot.sortOrder) }))
          .sort((a, b) => b.sortKey - a.sortKey || a.batch.name.localeCompare(b.batch.name));

        return (
          <div key={day} className="glass rounded-lg overflow-hidden">
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
              <ChevronDown
                className={`size-4 text-slate transition-transform duration-150 ${collapsed ? "" : "rotate-180"}`}
                aria-hidden="true"
              />
            </button>

            {!collapsed && (
              <div className="border-t border-border px-5 py-4 space-y-4">
                {batchGroups.map((group, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between gap-2">
                      <BatchPill batch={group.batch} section={group.section} />
                      {editable && onAddSession && (
                        <button
                          type="button"
                          onClick={() => onAddSession({ day, batch: group.batch, section: group.section })}
                          className="print:hidden inline-flex items-center gap-1 text-xs font-semibold text-primary hover:opacity-80"
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                          Add class
                        </button>
                      )}
                    </div>
                    <div className="mt-2 bg-card border border-border rounded-lg p-3 space-y-2">
                      {group.sessions.map((s) => (
                        <div key={s.id} className="group/bar">
                          <Bar session={s} renderActions={renderActions} editable={editable} onEditSession={onEditSession} onDeleteSession={onDeleteSession} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
