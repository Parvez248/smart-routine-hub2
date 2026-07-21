"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { Table } from "@/app/components/ui/Table";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type TimeSlot = { id: number; label: string; sortOrder: number };
type TimeSlotForm = { label: string; sortOrder: string };

const emptyForm: TimeSlotForm = { label: "", sortOrder: "" };

export default function TimeSlotsSection() {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [form, setForm] = useState<TimeSlotForm>(emptyForm);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<TimeSlotForm>(emptyForm);
  const [editSubmitting, setEditSubmitting] = useState(false);

  async function loadTimeSlots() {
    const res = await fetch("/api/admin/timeslots");
    const json = await res.json();
    if (json.ok) setTimeSlots(json.data);
    setLoadingState(false);
  }

  useEffect(() => { loadTimeSlots(); }, []);

  function flash(type: "success" | "error", msg: string) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/timeslots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Time slot added.");
        setForm(emptyForm);
        await loadTimeSlots();
      } else {
        flash("error", json.error ?? "Failed to add time slot.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(timeSlot: TimeSlot) {
    setEditingId(timeSlot.id);
    setEditForm({ label: timeSlot.label, sortOrder: String(timeSlot.sortOrder) });
  }

  async function handleEditSubmit(id: number) {
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/admin/timeslots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Time slot updated.");
        setEditingId(null);
        await loadTimeSlots();
      } else {
        flash("error", json.error ?? "Failed to update time slot.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this time slot? This cannot be undone.")) return;
    setDeleteId(id);
    try {
      const res = await fetch(`/api/admin/timeslots/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Time slot deleted.");
        await loadTimeSlots();
      } else {
        flash("error", json.error ?? "Failed to delete time slot.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader title="Add Time Slot" accent />
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Label <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. 8:30 - 10:00"
                className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Sort Order <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                required
                min={1}
                value={form.sortOrder}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                placeholder="e.g. 1"
                className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>
          </div>

          {status && <Message type={status.type}>{status.msg}</Message>}

          <div className="flex justify-end">
            <Button type="submit" loading={submitting}>
              {submitting ? "Adding…" : "Add Time Slot"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title={<>Time Slots <span className="ml-2 text-sm font-normal text-slate">{timeSlots.length}</span></>} />

        {loading ? (
          <Loading />
        ) : timeSlots.length === 0 ? (
          <EmptyState icon="⏰" message="No time slots yet. Add one above." />
        ) : (
          <Table headers={["Label", "Sort Order", ""]}>
            {timeSlots.map((t) =>
              editingId === t.id ? (
                <tr key={t.id} className="bg-primary/5">
                  <td className="px-5 py-3">
                    <input
                      value={editForm.label}
                      onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                      className="w-full border border-border bg-card rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </td>
                  <td className="px-5 py-3">
                    <input
                      type="number"
                      min={1}
                      value={editForm.sortOrder}
                      onChange={(e) => setEditForm((f) => ({ ...f, sortOrder: e.target.value }))}
                      className="w-full border border-border bg-card rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <LinkButton tone="primary" loading={editSubmitting} onClick={() => handleEditSubmit(t.id)} className="mr-3">
                      Save
                    </LinkButton>
                    <LinkButton tone="neutral" onClick={() => setEditingId(null)}>
                      Cancel
                    </LinkButton>
                  </td>
                </tr>
              ) : (
                <tr key={t.id} className="hover:bg-muted/40 transition-colors group">
                  <td className="px-5 py-3.5 font-semibold font-data text-foreground">{t.label}</td>
                  <td className="px-5 py-3.5 text-muted-foreground font-data">{t.sortOrder}</td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <LinkButton tone="primary" muted revealOnHover onClick={() => startEdit(t)} className="mr-3">
                      Edit
                    </LinkButton>
                    <LinkButton tone="danger" muted revealOnHover loading={deleteId === t.id} onClick={() => handleDelete(t.id)}>
                      {deleteId === t.id ? "Deleting…" : "Delete"}
                    </LinkButton>
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
