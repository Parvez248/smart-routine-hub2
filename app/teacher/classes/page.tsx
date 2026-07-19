"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { Table } from "@/app/components/ui/Table";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type ClassSession = {
  id: number;
  day: string;
  section: string | null;
  status: string;
  course: { id: number; code: string; type: string };
  room: { id: number; name: string; capacity: number };
  batch: { id: number; name: string; semester: string };
  timeSlot: { id: number; label: string; sortOrder: number };
};

type RefData = {
  days: string[];
  timeSlots: { id: number; label: string; sortOrder: number }[];
  rooms: { id: number; name: string; capacity: number }[];
};

type RescheduleForm = { newDay: string; newTimeSlotId: string; newRoomId: string; reason: string };
const emptyForm: RescheduleForm = { newDay: "", newTimeSlotId: "", newRoomId: "", reason: "" };

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [ref, setRef] = useState<RefData | null>(null);
  const [pendingSessionIds, setPendingSessionIds] = useState<Set<number>>(new Set());

  const [reschedulingId, setReschedulingId] = useState<number | null>(null);
  const [form, setForm] = useState<RescheduleForm>(emptyForm);
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
    setForm({
      newDay: c.day,
      newTimeSlotId: String(c.timeSlot.id),
      newRoomId: String(c.room.id),
      reason: "",
    });
    setStatus(null);
  }

  function cancelReschedule() {
    setReschedulingId(null);
    setForm(emptyForm);
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
          newDay: form.newDay,
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

  return (
    <>
      <PageHeader
        title="My Classes"
        description="Classes from the published routine. Reschedule requests need admin approval before the class moves."
        action={
          <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-3 py-1 rounded-full">
            {classes.length} classes
          </span>
        }
      />

      {status && <Message type={status.type}>{status.msg}</Message>}

      <Card>
        <CardHeader title={<>My Classes <span className="ml-2 text-sm font-normal text-gray-400">{classes.length}</span></>} />

        {loading ? (
          <Loading />
        ) : classes.length === 0 ? (
          <EmptyState icon="📅" message="No classes assigned to you in the published routine." />
        ) : (
          <Table headers={["Day", "Time Slot", "Batch", "Course", "Room", "Status", ""]}>
            {classes.map((c) =>
              reschedulingId === c.id ? (
                <tr key={c.id} className="bg-indigo-50/40">
                  <td colSpan={7} className="px-5 py-4">
                    <form onSubmit={handleReschedule} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Day</label>
                        <select
                          required
                          value={form.newDay}
                          onChange={(e) => setForm((f) => ({ ...f, newDay: e.target.value }))}
                          className="border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select day</option>
                          {ref?.days.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Time Slot</label>
                        <select
                          required
                          value={form.newTimeSlotId}
                          onChange={(e) => setForm((f) => ({ ...f, newTimeSlotId: e.target.value }))}
                          className="border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select slot</option>
                          {ref?.timeSlots.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Room</label>
                        <select
                          required
                          value={form.newRoomId}
                          onChange={(e) => setForm((f) => ({ ...f, newRoomId: e.target.value }))}
                          className="border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select room</option>
                          {ref?.rooms.map((r) => (
                            <option key={r.id} value={r.id}>Room {r.name} (cap {r.capacity})</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Reason <span className="text-gray-300 normal-case font-normal">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={form.reason}
                          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                          placeholder="e.g. Conflict with seminar"
                          className="border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="sm:col-span-4 flex justify-end gap-4">
                        <LinkButton type="button" tone="neutral" onClick={cancelReschedule}>
                          Cancel
                        </LinkButton>
                        <Button type="submit" loading={submitting}>
                          {submitting ? "Saving…" : "Confirm Reschedule"}
                        </Button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr
                  key={c.id}
                  className={`hover:bg-slate-50 transition-colors group ${c.status === "CANCELLED" ? "bg-gray-50/60 opacity-60" : ""}`}
                >
                  <td className="px-5 py-3.5 font-semibold text-gray-700">{c.day}</td>
                  <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{c.timeSlot.label}</td>
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-gray-700">{c.batch.name}</span>
                    {c.section && (
                      <span className="ml-1.5 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {c.section}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-gray-800">{c.course.code}</td>
                  <td className="px-5 py-3.5 text-gray-600">Room {c.room.name}</td>
                  <td className="px-5 py-3.5">
                    {c.status === "CANCELLED" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        Cancelled
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    {pendingSessionIds.has(c.id) ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
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
