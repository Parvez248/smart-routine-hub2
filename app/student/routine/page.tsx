"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { LinkButton } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";
import { nextOccurrenceOf } from "@/lib/services/timeslot";
import { useRoutineFilters } from "@/app/components/routine/useRoutineFilters";
import { RoutineFilterBar } from "@/app/components/routine/RoutineFilterBar";
import { PrintButton, PrintHeader } from "@/app/components/routine/PrintPanel";
import type { FilterableSession } from "@/app/components/routine/types";

type SessionCell = {
  id: number;
  day: string;
  section: string | null;
  status: string;
  course: { code: string; title: string; type: string };
  teacher: { initials: string; name: string };
  room: { name: string };
  batch: { id: number; name: string; semester: string };
  timeSlot: { id: number; label: string; sortOrder: number };
  movedTo: FilterableSession["movedTo"];
};

type Batch = { id: number; name: string; semester: string };
type TimeSlot = { id: number; label: string; sortOrder: number };
type AlarmRow = { id: number; sessionId: number; leadMinutes: number; isActive: boolean };

const DAY_ORDER = ["Sat", "Sun", "Mon", "Tues", "Wed"];
const LEAD_OPTIONS = [5, 10, 15, 30];

function formatMovedDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
      type === "LAB" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
    }`}>
      {type === "LAB" ? "Lab" : "Theory"}
    </span>
  );
}

function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return `${minutes}m ${totalSeconds % 60}s`;
}

function StudentRoutineInner() {
  const [sessions, setSessions] = useState<SessionCell[]>([]);
  const [versionName, setVersionName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoadingState] = useState(true);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [myBatchId, setMyBatchId] = useState<string>("");

  const [alarms, setAlarms] = useState<AlarmRow[]>([]);
  const [openBellFor, setOpenBellFor] = useState<number | null>(null);
  const [bellLeadMinutes, setBellLeadMinutes] = useState<number>(15);
  const [bellSubmitting, setBellSubmitting] = useState(false);

  const [now, setNow] = useState(new Date());

  async function loadRoutine(batchId?: string) {
    setLoadingState(true);
    const url = batchId ? `/api/student/routine?batchId=${batchId}` : "/api/student/routine";
    const res = await fetch(url);
    const json = await res.json();
    if (json.ok) {
      setSessions(json.data.sessions);
      setVersionName(json.data.versionName);
      setMessage(json.data.message);
      setSelectedBatchId(String(json.data.batchId));
      if (!batchId) setMyBatchId(String(json.data.batchId));
    }
    setLoadingState(false);
  }

  async function loadAlarms() {
    const res = await fetch("/api/student/alarms");
    const json = await res.json();
    if (json.ok) setAlarms(json.data);
  }

  useEffect(() => {
    fetch("/api/public/batches").then((res) => res.json()).then((json) => { if (json.ok) setBatches(json.data); });
    fetch("/api/reference").then((res) => res.json()).then((json) => { if (json.ok) setTimeSlots(json.data.timeSlots); });
    loadRoutine();
    loadAlarms();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  function handleBatchChange(batchId: string) {
    setSelectedBatchId(batchId);
    setOpenBellFor(null);
    loadRoutine(batchId);
  }

  const filterState = useRoutineFilters(sessions, { storageKey: "student" });
  const { filtered, totalCount, clearAll } = filterState;

  const cellFor = (day: string, timeSlotId: number) =>
    filtered.filter((s) => s.day === day && s.timeSlot.id === timeSlotId);

  const alarmBySessionId = useMemo(
    () => new Map(alarms.map((a) => [a.sessionId, a])),
    [alarms]
  );

  const viewingOwnBatch = myBatchId !== "" && selectedBatchId === myBatchId;

  const nextClass = useMemo(() => {
    if (!viewingOwnBatch) return null;
    const upcoming = sessions
      .filter((s) => s.status !== "CANCELLED")
      .map((s) => ({ session: s, at: nextOccurrenceOf(s.day, s.timeSlot.label, now) }))
      .filter((x): x is { session: SessionCell; at: Date } => x.at !== null)
      .sort((a, b) => a.at.getTime() - b.at.getTime());
    return upcoming[0] ?? null;
  }, [sessions, now, viewingOwnBatch]);

  function openBell(session: SessionCell) {
    const existing = alarmBySessionId.get(session.id);
    setBellLeadMinutes(existing?.leadMinutes ?? 15);
    setOpenBellFor(session.id);
  }

  function requestNotificationPermissionIfNeeded() {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }

  async function handleSaveReminder(session: SessionCell) {
    setBellSubmitting(true);
    try {
      const existing = alarmBySessionId.get(session.id);
      const res = existing
        ? await fetch(`/api/student/alarms/${existing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leadMinutes: bellLeadMinutes }),
          })
        : await fetch("/api/student/alarms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: session.id, leadMinutes: bellLeadMinutes }),
          });
      const json = await res.json();
      if (json.ok) {
        requestNotificationPermissionIfNeeded();
        setOpenBellFor(null);
        await loadAlarms();
      }
    } finally {
      setBellSubmitting(false);
    }
  }

  async function handleRemoveReminder(alarmId: number) {
    setBellSubmitting(true);
    try {
      await fetch(`/api/student/alarms/${alarmId}`, { method: "DELETE" });
      setOpenBellFor(null);
      await loadAlarms();
    } finally {
      setBellSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="My Routine"
        description={versionName ? `Published version: ${versionName}` : "No routine published yet."}
        action={
          <div className="flex items-center gap-2 print:hidden">
            <label htmlFor="student-routine-batch" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Batch</label>
            <select
              id="student-routine-batch"
              value={selectedBatchId}
              onChange={(e) => handleBatchChange(e.target.value)}
              className="border border-border bg-muted rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name} — {b.semester} sem</option>
              ))}
            </select>
          </div>
        }
      />

      {nextClass && (
        <div className="print:hidden bg-primary rounded-2xl px-6 py-4 text-white flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-primary-foreground/70 font-semibold uppercase tracking-wide">Next Class</p>
            <p className="text-lg font-bold mt-0.5">
              {nextClass.session.course.code} · {nextClass.session.day} · {nextClass.session.timeSlot.label}
            </p>
            <p className="text-sm text-primary-foreground/80 mt-0.5">
              {nextClass.session.teacher.initials} · Room {nextClass.session.room.name}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-primary-foreground/70 font-semibold uppercase tracking-wide">Starts in</p>
            <p className="text-2xl font-bold tabular-nums">{formatCountdown(nextClass.at.getTime() - now.getTime())}</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader title="Weekly Routine" action={<PrintButton />} />

        <PrintHeader subtitle="My Routine" filterSummary={filterState.chips.map((c) => c.label).join(", ")} />

        <div className="px-6 py-4 border-b border-border print:hidden">
          <RoutineFilterBar state={filterState} />
        </div>

        <div className="px-6 py-3 text-xs text-slate print:hidden">
          Showing {filtered.length} of {totalCount} classes
        </div>

        {loading ? (
          <Loading />
        ) : message ? (
          <EmptyState icon="🗓️" message={message} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="🔍" message="No classes match these filters." action={
            <button type="button" onClick={clearAll} className="text-xs font-semibold text-primary hover:opacity-80">
              Clear all filters
            </button>
          } />
        ) : (
          <div className="overflow-x-auto pb-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted text-slate text-xs uppercase tracking-wide">
                  <th scope="col" className="px-4 py-3 text-left font-semibold whitespace-nowrap">Time Slot</th>
                  {DAY_ORDER.map((d) => (
                    <th key={d} scope="col" className="px-4 py-3 text-left font-semibold whitespace-nowrap">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {timeSlots.map((slot) => (
                  <tr key={slot.id}>
                    <td className="px-4 py-3 text-muted-foreground font-medium whitespace-nowrap align-top">{slot.label}</td>
                    {DAY_ORDER.map((day) => {
                      const cellSessions = cellFor(day, slot.id);
                      return (
                        <td key={day} className="px-4 py-3 align-top min-w-[140px]">
                          {cellSessions.length === 0 ? (
                            <span className="text-border">—</span>
                          ) : (
                            <div className="space-y-2">
                              {cellSessions.map((s) => {
                                const cancelled = s.status === "CANCELLED";
                                const moved = !cancelled && Boolean(s.movedTo);
                                const alarm = alarmBySessionId.get(s.id);
                                const bellOpen = openBellFor === s.id;
                                return (
                                  <div
                                    key={s.id}
                                    className={`rounded-lg border px-2.5 py-2 ${
                                      cancelled ? "border-cancelled/20 bg-cancelled/5" : "border-border bg-muted"
                                    } ${cancelled ? "shadow-[inset_3px_0_0_0_var(--cancelled)]" : moved ? "shadow-[inset_3px_0_0_0_var(--moved)]" : "shadow-[inset_3px_0_0_0_var(--confirmed)]"}`}
                                  >
                                    <div className="flex items-start justify-between gap-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`font-semibold text-foreground ${cancelled ? "line-through text-slate" : ""}`}>
                                          {s.course.code}
                                        </span>
                                        <TypeBadge type={s.course.type} />
                                        {cancelled && (
                                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-cancelled/10 text-cancelled">
                                            Cancelled
                                          </span>
                                        )}
                                      </div>
                                      {viewingOwnBatch && !cancelled && (
                                        <button
                                          type="button"
                                          onClick={() => (bellOpen ? setOpenBellFor(null) : openBell(s))}
                                          className={`print:hidden text-sm leading-none shrink-0 ${alarm ? "opacity-100" : "opacity-40 hover:opacity-100"}`}
                                          title={alarm ? "Reminder set" : "Set reminder"}
                                          aria-label={alarm ? "Reminder set. Click to edit." : "Set reminder"}
                                        >
                                          {alarm ? "🔔" : "🔕"}
                                        </button>
                                      )}
                                    </div>
                                    <p className={`text-xs text-muted-foreground mt-1 ${cancelled ? "line-through text-muted-foreground/60" : ""}`}>
                                      {s.teacher.initials} · Room {s.room.name}
                                      {s.section ? ` · ${s.section}` : ""}
                                    </p>
                                    {!cancelled && s.movedTo && (
                                      <p className="text-[11px] text-moved mt-1">
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-moved/10 text-moved mr-1">
                                          {s.movedTo.date ? `Moved on ${formatMovedDate(s.movedTo.date)}` : "Moved"}
                                        </span>
                                        to {s.movedTo.day}, {s.movedTo.timeSlot?.label}, Room {s.movedTo.room?.name}
                                      </p>
                                    )}

                                    {bellOpen && (
                                      <div className="print:hidden mt-2 pt-2 border-t border-border space-y-2">
                                        <div className="flex items-center gap-1 flex-wrap">
                                          {LEAD_OPTIONS.map((m) => (
                                            <button
                                              key={m}
                                              onClick={() => setBellLeadMinutes(m)}
                                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                                                bellLeadMinutes === m
                                                  ? "bg-primary text-white"
                                                  : "bg-surface text-muted-foreground border border-border hover:bg-muted"
                                              }`}
                                            >
                                              {m}m
                                            </button>
                                          ))}
                                        </div>
                                        <div className="flex items-center gap-3">
                                          <LinkButton
                                            tone="primary"
                                            loading={bellSubmitting}
                                            onClick={() => handleSaveReminder(s)}
                                          >
                                            {alarm ? "Update" : "Set reminder"}
                                          </LinkButton>
                                          {alarm && (
                                            <LinkButton
                                              tone="danger"
                                              loading={bellSubmitting}
                                              onClick={() => handleRemoveReminder(alarm.id)}
                                            >
                                              Remove
                                            </LinkButton>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
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
        )}
      </Card>
    </>
  );
}

export default function StudentRoutinePage() {
  return (
    <Suspense fallback={<Loading />}>
      <StudentRoutineInner />
    </Suspense>
  );
}
