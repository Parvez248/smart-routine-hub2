"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Loading } from "@/app/components/ui/Loading";
import { LinkButton } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { nextOccurrenceOf } from "@/lib/services/timeslot";
import { useRoutineFilters } from "@/app/components/routine/useRoutineFilters";
import { RoutineList } from "@/app/components/routine/RoutineList";
import { RoutineTimeRail } from "@/app/components/routine/RoutineTimeRail";
import { RoutineMasthead } from "@/app/components/routine/RoutineMasthead";
import { FilterCard } from "@/app/components/routine/FilterCard";
import { ViewToggle, type RoutineView } from "@/app/components/routine/ViewToggle";
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
type AlarmRow = { id: number; sessionId: number; leadMinutes: number; isActive: boolean };

const LEAD_OPTIONS = [5, 10, 15, 30];

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

// The reminder-bell affordance, plugged into the shared routine components'
// renderActions slot so student keeps the exact same set/update/remove
// reminder behaviour after unifying onto the shared routine document.
function ReminderBell({
  session, alarm, bellOpen, onToggle, leadMinutes, onLeadChange, submitting, onSave, onRemove,
}: {
  session: SessionCell;
  alarm: AlarmRow | undefined;
  bellOpen: boolean;
  onToggle: () => void;
  leadMinutes: number;
  onLeadChange: (m: number) => void;
  submitting: boolean;
  onSave: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`text-base leading-none ${alarm ? "opacity-100" : "opacity-40 hover:opacity-100"}`}
        title={alarm ? "Reminder set" : "Set reminder"}
        aria-label={alarm ? "Reminder set. Click to edit." : "Set reminder"}
      >
        {alarm ? "🔔" : "🔕"}
      </button>
      {bellOpen && (
        <div className="absolute right-0 top-full mt-2 z-40 w-56 bg-popover text-popover-foreground border border-border rounded-md shadow-md ring-1 ring-foreground/10 p-3 space-y-2 text-left">
          <div className="flex items-center gap-1 flex-wrap">
            {LEAD_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onLeadChange(m)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                  leadMinutes === m
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground border border-border hover:bg-muted/70"
                }`}
              >
                {m}m
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <LinkButton tone="primary" loading={submitting} onClick={onSave}>
              {alarm ? "Update" : "Set reminder"}
            </LinkButton>
            {alarm && (
              <LinkButton tone="danger" loading={submitting} onClick={onRemove}>
                Remove
              </LinkButton>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StudentRoutineInner() {
  const [sessions, setSessions] = useState<SessionCell[]>([]);
  const [versionName, setVersionName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoadingState] = useState(true);
  const [view, setView] = useState<RoutineView>("rail");

  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [myBatchId, setMyBatchId] = useState<string>("");

  const [alarms, setAlarms] = useState<AlarmRow[]>([]);
  const [openBellFor, setOpenBellFor] = useState<number | null>(null);
  const [bellLeadMinutes, setBellLeadMinutes] = useState<number>(15);
  const [bellSubmitting, setBellSubmitting] = useState(false);

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    document.title = "My Routine · Routine Management System";
  }, []);

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

  const renderActions = (s: SessionCell) => {
    if (!viewingOwnBatch || s.status === "CANCELLED") return null;
    return (
      <ReminderBell
        session={s}
        alarm={alarmBySessionId.get(s.id)}
        bellOpen={openBellFor === s.id}
        onToggle={() => (openBellFor === s.id ? setOpenBellFor(null) : openBell(s))}
        leadMinutes={bellLeadMinutes}
        onLeadChange={setBellLeadMinutes}
        submitting={bellSubmitting}
        onSave={() => handleSaveReminder(s)}
        onRemove={() => {
          const alarm = alarmBySessionId.get(s.id);
          if (alarm) handleRemoveReminder(alarm.id);
        }}
      />
    );
  };

  return (
    <>
      <div className="print:hidden flex items-center justify-end gap-2">
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

      {nextClass && (
        <div className="print:hidden bg-primary rounded-lg px-6 py-4 text-white flex items-center justify-between gap-4 flex-wrap">
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

      <RoutineMasthead versionName={versionName} filterSummary={filterState.chips.map((c) => c.label).join(", ")} />

      <FilterCard state={filterState} totalCount={totalCount} />

      <div className="print:hidden flex items-center justify-end">
        <ViewToggle value={view} onChange={setView} />
      </div>

      {message ? (
        <div className="glass rounded-lg overflow-hidden">
          <EmptyState icon="🗓️" message={message} />
        </div>
      ) : view === "rail" ? (
        <RoutineTimeRail sessions={filtered} loading={loading} onClearFilters={clearAll} renderActions={renderActions} />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <RoutineList sessions={filtered} loading={loading} onClearFilters={clearAll} renderActions={renderActions} />
        </div>
      )}
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
