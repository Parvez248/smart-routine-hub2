"use client";

import { useEffect, useState } from "react";
import { CalendarClock, DoorOpen } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TypePill, courseTitleIfDifferent } from "@/app/components/routine/RowBadges";
import { bandEdgeClass, bandForBatch } from "@/lib/ui/bandColors";
import { nextOccurrences, formatDateOnly, isClassDay, isOnOrAfterToday, parseDateOnly, today } from "@/lib/services/dates";

const DAY_ORDER = ["Sat", "Sun", "Mon", "Tues", "Wed"];
const DAY_NAME: Record<string, string> = { Sat: "Saturday", Sun: "Sunday", Mon: "Monday", Tues: "Tuesday", Wed: "Wednesday" };

type ClassSession = {
  id: number;
  day: string;
  section: string | null;
  status: string;
  course: { id: number; code: string; title: string; type: string };
  room: { id: number; name: string; capacity: number };
  batch: { id: number; name: string; semester: string; studentCount: number };
  timeSlot: { id: number; label: string; sortOrder: number };
};

type RefData = {
  timeSlots: { id: number; label: string; sortOrder: number }[];
};

type FreeRoom = { id: number; name: string; capacity: number };

type RescheduleForm = { originalDate: string; newDate: string; newTimeSlotId: string; newRoomId: string; reason: string };
const emptyForm: RescheduleForm = { originalDate: "", newDate: "", newTimeSlotId: "", newRoomId: "", reason: "" };

const OCCURRENCE_COUNT = 8;

function formatOccurrence(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/70 font-medium">{label}</dt>
      <dd className="font-data text-foreground mt-0.5">{value}</dd>
    </div>
  );
}

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [ref, setRef] = useState<RefData | null>(null);
  const [pendingSessionIds, setPendingSessionIds] = useState<Set<number>>(new Set());

  const [reschedulingClass, setReschedulingClass] = useState<ClassSession | null>(null);
  const [occurrences, setOccurrences] = useState<Date[]>([]);
  const [form, setForm] = useState<RescheduleForm>(emptyForm);
  const [dateError, setDateError] = useState<string | null>(null);
  const [freeRooms, setFreeRooms] = useState<FreeRoom[] | null>(null);
  const [freeRoomsLoading, setFreeRoomsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  async function loadClasses() {
    const res = await fetch("/api/teacher/classes");
    const json = await res.json();
    if (json.ok) setClasses(json.data);
    setLoadingState(false);
  }

  async function loadRef() {
    const res = await fetch("/api/reference");
    const json = await res.json();
    if (json.ok) setRef(json.data);
  }

  async function loadPendingRequests() {
    const res = await fetch("/api/teacher/reschedule-requests");
    const json = await res.json();
    if (json.ok) {
      const pending = json.data.filter((r: { status: string }) => r.status === "PENDING");
      setPendingSessionIds(new Set(pending.map((r: { sessionId: number }) => r.sessionId)));
    }
  }

  useEffect(() => { loadClasses(); loadRef(); loadPendingRequests(); }, []);

  function startReschedule(c: ClassSession) {
    setReschedulingClass(c);
    const occ = nextOccurrences(c.day, OCCURRENCE_COUNT);
    setOccurrences(occ);
    setForm({
      originalDate: occ.length ? formatDateOnly(occ[0]) : "",
      newDate: "",
      newTimeSlotId: "",
      newRoomId: "",
      reason: "",
    });
    setDateError(null);
    setFreeRooms(null);
    setStatus(null);
  }

  function cancelReschedule() {
    setReschedulingClass(null);
    setForm(emptyForm);
    setFreeRooms(null);
    setDateError(null);
  }

  async function loadFreeRooms(newDate: string, newTimeSlotId: string) {
    if (!newDate || !newTimeSlotId) {
      setFreeRooms(null);
      return;
    }
    setFreeRoomsLoading(true);
    setFreeRooms(null);
    try {
      const res = await fetch(`/api/teacher/free-rooms?date=${newDate}&timeSlotId=${newTimeSlotId}`);
      const json = await res.json();
      if (json.ok) setFreeRooms(json.data);
    } finally {
      setFreeRoomsLoading(false);
    }
  }

  function handleNewDateChange(value: string) {
    setForm((f) => ({ ...f, newDate: value, newRoomId: "" }));
    setFreeRooms(null);

    const parsed = parseDateOnly(value);
    if (!parsed) {
      setDateError(null);
      return;
    }
    if (!isOnOrAfterToday(parsed)) {
      setDateError("The new date must be today or later.");
      return;
    }
    if (!isClassDay(parsed)) {
      setDateError("The new date must be a class day (Sat–Wed) — Thu and Fri have no classes.");
      return;
    }
    setDateError(null);
    if (form.newTimeSlotId) loadFreeRooms(value, form.newTimeSlotId);
  }

  function handleNewTimeSlotChange(value: string) {
    setForm((f) => ({ ...f, newTimeSlotId: value, newRoomId: "" }));
    if (!dateError && form.newDate) loadFreeRooms(form.newDate, value);
  }

  async function handleReschedule(e: React.FormEvent) {
    e.preventDefault();
    if (!reschedulingClass) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/teacher/reschedule-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: reschedulingClass.id,
          originalDate: form.originalDate,
          newDate: form.newDate,
          newTimeSlotId: Number(form.newTimeSlotId),
          newRoomId: Number(form.newRoomId),
          reason: form.reason.trim() || null,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setStatus({ type: "success", msg: "Reschedule request submitted — awaiting admin approval. The class stays where it is until then." });
        cancelReschedule();
        await loadPendingRequests();
      } else {
        setStatus({ type: "error", msg: json.error ?? "Failed to submit request." });
      }
    } catch {
      setStatus({ type: "error", msg: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  const minDate = formatDateOnly(today());
  const batchStudentCount = reschedulingClass?.batch.studentCount ?? 0;

  const byDay = new Map<string, ClassSession[]>();
  for (const c of classes) {
    if (!byDay.has(c.day)) byDay.set(c.day, []);
    byDay.get(c.day)!.push(c);
  }
  const days = DAY_ORDER.filter((d) => (byDay.get(d) ?? []).length > 0);

  return (
    <>
      <PageHeader
        title="My Classes"
        description="Your classes in the published routine. Reschedule requests need admin approval before the class moves."
        action={
          <span className="text-xs bg-primary/10 text-primary font-semibold px-3 py-1 rounded-full font-data">
            {classes.length} classes
          </span>
        }
      />

      {status && <Message type={status.type}>{status.msg}</Message>}

      {loading ? (
        <Loading />
      ) : classes.length === 0 ? (
        <EmptyState icon="📅" message="You have no classes yet." />
      ) : (
        <div className="space-y-8">
          {days.map((day) => {
            const dayClasses = (byDay.get(day) ?? []).sort((a, b) => a.timeSlot.sortOrder - b.timeSlot.sortOrder);
            return (
              <div key={day}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="font-heading text-base font-semibold text-foreground">{DAY_NAME[day] ?? day}</h2>
                  <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-data">
                    {dayClasses.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dayClasses.map((c) => {
                    const cancelled = c.status === "CANCELLED";
                    const band = bandForBatch(c.batch);
                    const title = courseTitleIfDifferent(c.course);

                    return (
                      <div
                        key={c.id}
                        className={`bg-card border border-border rounded-lg overflow-hidden ${bandEdgeClass(band)} ${cancelled ? "opacity-60" : ""}`}
                      >
                        <div className="p-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-semibold text-base ${cancelled ? "text-muted-foreground line-through" : "text-foreground"}`}>
                              {c.course.code}
                            </span>
                            <TypePill type={c.course.type} batch={c.batch} />
                          </div>
                          {title && <p className="text-xs text-slate mt-0.5 truncate">{title}</p>}

                          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 mt-3 text-xs">
                            <DetailItem label="Time" value={c.timeSlot.label} />
                            <DetailItem label="Room" value={c.room.name} />
                            <DetailItem label="Batch" value={`${c.batch.name}${c.section ? ` · ${c.section}` : ""}`} />
                          </dl>

                          <div className="mt-3.5 flex items-center justify-between gap-2">
                            <StatusBadge status={cancelled ? "Cancelled" : "Active"} />
                            {pendingSessionIds.has(c.id) ? (
                              <span className="text-xs font-semibold text-pending">Pending approval</span>
                            ) : (
                              <LinkButton tone="primary" onClick={() => startReschedule(c)}>
                                Reschedule
                              </LinkButton>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(reschedulingClass)} onOpenChange={(open) => { if (!open) cancelReschedule(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-primary" aria-hidden="true" />
              Reschedule {reschedulingClass?.course.code} · {reschedulingClass?.day}, {reschedulingClass?.timeSlot.label}
            </DialogTitle>
            <DialogDescription>
              Pick a new date and time slot. The admin must approve this before the class actually moves.
            </DialogDescription>
          </DialogHeader>

          {reschedulingClass && (
            <form onSubmit={handleReschedule} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="reschedule-original-date" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Which class date?
                  </label>
                  <select
                    id="reschedule-original-date"
                    required
                    value={form.originalDate}
                    onChange={(e) => setForm((f) => ({ ...f, originalDate: e.target.value }))}
                    className="border border-border bg-surface rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {occurrences.map((d) => (
                      <option key={formatDateOnly(d)} value={formatDateOnly(d)}>
                        {formatOccurrence(d)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="reschedule-new-date" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Date</label>
                  <input
                    id="reschedule-new-date"
                    type="date"
                    required
                    min={minDate}
                    value={form.newDate}
                    onChange={(e) => handleNewDateChange(e.target.value)}
                    className="border border-border bg-surface rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="reschedule-new-slot" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Time Slot</label>
                  <select
                    id="reschedule-new-slot"
                    required
                    value={form.newTimeSlotId}
                    onChange={(e) => handleNewTimeSlotChange(e.target.value)}
                    className="border border-border bg-surface rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select slot</option>
                    {ref?.timeSlots.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="reschedule-reason" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Reason <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span>
                  </label>
                  <input
                    id="reschedule-reason"
                    type="text"
                    value={form.reason}
                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    placeholder="e.g. Conflict with seminar"
                    className="border border-border bg-surface rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {dateError && <Message type="error">{dateError}</Message>}

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Free rooms for that date &amp; slot
                </label>
                <div className="mt-2">
                  {!form.newDate || !form.newTimeSlotId || dateError ? (
                    <p className="text-xs text-slate">Pick a new date and time slot to see free rooms.</p>
                  ) : freeRoomsLoading ? (
                    <p className="text-xs text-slate">Searching…</p>
                  ) : freeRooms && freeRooms.length === 0 ? (
                    <p className="text-xs text-cancelled">No rooms are free at this date &amp; time.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {freeRooms?.map((r) => {
                        const tooSmall = r.capacity < batchStudentCount;
                        const selected = form.newRoomId === String(r.id);
                        return (
                          <button
                            type="button"
                            key={r.id}
                            disabled={tooSmall}
                            onClick={() => setForm((f) => ({ ...f, newRoomId: String(r.id) }))}
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                              tooSmall
                                ? "border-border bg-muted text-muted-foreground/60 cursor-not-allowed"
                                : selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-confirmed/20 bg-confirmed/10 text-confirmed hover:bg-confirmed/15"
                            }`}
                            title={tooSmall ? `Too small for batch (${batchStudentCount} students)` : undefined}
                          >
                            <DoorOpen className="size-3.5" aria-hidden="true" />
                            Room {r.name} (cap {r.capacity})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-2">
                <LinkButton type="button" tone="neutral" onClick={cancelReschedule}>
                  Cancel
                </LinkButton>
                <Button type="submit" loading={submitting} disabled={!form.newRoomId}>
                  {submitting ? "Saving…" : "Confirm Reschedule"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
