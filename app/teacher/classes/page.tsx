"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { Table } from "@/app/components/ui/Table";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { nextOccurrences, formatDateOnly, isClassDay, isOnOrAfterToday, parseDateOnly, today } from "@/lib/services/dates";

type ClassSession = {
  id: number;
  day: string;
  section: string | null;
  status: string;
  course: { id: number; code: string; type: string };
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

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [ref, setRef] = useState<RefData | null>(null);
  const [pendingSessionIds, setPendingSessionIds] = useState<Set<number>>(new Set());

  const [reschedulingId, setReschedulingId] = useState<number | null>(null);
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
    setReschedulingId(c.id);
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
    setReschedulingId(null);
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
    if (!reschedulingId) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/teacher/reschedule-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: reschedulingId,
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

  return (
    <>
      <PageHeader
        title="My Classes"
        description="Classes from the published routine. Reschedule requests need admin approval before the class moves."
        action={
          <span className="text-xs bg-primary/10 text-primary font-semibold px-3 py-1 rounded-full">
            {classes.length} classes
          </span>
        }
      />

      {status && <Message type={status.type}>{status.msg}</Message>}

      <Card>
        <CardHeader title={<>My Classes <span className="ml-2 text-sm font-normal text-slate">{classes.length}</span></>} />

        {loading ? (
          <Loading />
        ) : classes.length === 0 ? (
          <EmptyState icon="📅" message="No classes assigned to you in the published routine." />
        ) : (
          <Table headers={["Day", "Time Slot", "Batch", "Course", "Room", "Status", ""]}>
            {classes.map((c) =>
              reschedulingId === c.id ? (
                <tr key={c.id} className="bg-primary/5">
                  <td colSpan={7} className="px-5 py-4">
                    <form onSubmit={handleReschedule} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Which class date?
                          </label>
                          <select
                            required
                            value={form.originalDate}
                            onChange={(e) => setForm((f) => ({ ...f, originalDate: e.target.value }))}
                            className="border border-border bg-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            {occurrences.map((d) => (
                              <option key={formatDateOnly(d)} value={formatDateOnly(d)}>
                                {formatOccurrence(d)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Date</label>
                          <input
                            type="date"
                            required
                            min={minDate}
                            value={form.newDate}
                            onChange={(e) => handleNewDateChange(e.target.value)}
                            className="border border-border bg-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Time Slot</label>
                          <select
                            required
                            value={form.newTimeSlotId}
                            onChange={(e) => handleNewTimeSlotChange(e.target.value)}
                            className="border border-border bg-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="">Select slot</option>
                            {ref?.timeSlots.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Reason <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={form.reason}
                            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                            placeholder="e.g. Conflict with seminar"
                            className="border border-border bg-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                                      tooSmall
                                        ? "border-border bg-muted text-muted-foreground/60 cursor-not-allowed"
                                        : selected
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-confirmed/20 bg-confirmed/10 text-confirmed hover:bg-confirmed/15"
                                    }`}
                                    title={tooSmall ? `Too small for batch (${batchStudentCount} students)` : undefined}
                                  >
                                    Room {r.name} (cap {r.capacity})
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end gap-4">
                        <LinkButton type="button" tone="neutral" onClick={cancelReschedule}>
                          Cancel
                        </LinkButton>
                        <Button type="submit" loading={submitting} disabled={!form.newRoomId}>
                          {submitting ? "Saving…" : "Confirm Reschedule"}
                        </Button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr
                  key={c.id}
                  className={`hover:bg-muted/40 transition-colors group ${c.status === "CANCELLED" ? "bg-muted/60 opacity-60" : ""}`}
                >
                  <td className="px-5 py-3.5 font-semibold font-data text-foreground">{c.day}</td>
                  <td className="px-5 py-3.5 text-muted-foreground font-data whitespace-nowrap">{c.timeSlot.label}</td>
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-foreground">{c.batch.name}</span>
                    {c.section && (
                      <span className="ml-1.5 text-xs text-slate bg-muted px-1.5 py-0.5 rounded">
                        {c.section}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-semibold font-data text-foreground">{c.course.code}</td>
                  <td className="px-5 py-3.5 text-muted-foreground font-data">Room {c.room.name}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={c.status === "CANCELLED" ? "Cancelled" : "Active"} />
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    {pendingSessionIds.has(c.id) ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-moved/10 text-moved">
                        Pending approval
                      </span>
                    ) : (
                      <LinkButton tone="primary" onClick={() => startReschedule(c)}>
                        Reschedule
                      </LinkButton>
                    )}
                  </td>
                </tr>
              )
            )}
          </Table>
        )}
      </Card>
    </>
  );
}
