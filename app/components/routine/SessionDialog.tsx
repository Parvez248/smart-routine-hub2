"use client";

import { useEffect, useState } from "react";
import { DoorOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { Message } from "@/app/components/ui/Message";

type RefCourse = { id: number; code: string; type: string };
type RefTeacher = { id: number; initials: string; name: string };
type RefRoom = { id: number; name: string; capacity: number };
type RefBatch = { id: number; name: string; semester: string };
type RefTimeSlot = { id: number; label: string; sortOrder: number };

type RefData = {
  courses: RefCourse[];
  teachers: RefTeacher[];
  rooms: RefRoom[];
  batches: RefBatch[];
  timeSlots: RefTimeSlot[];
  days: string[];
};

export type SessionFormValues = {
  id?: number;
  day: string;
  timeSlotId: string;
  batchId: string;
  section: string;
  courseId: string;
  teacherId: string;
  roomId: string;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const selectClass =
  "w-full border border-border bg-surface rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

// Shared create/edit dialog for admin inline editing on the Full Routine view
// (Step 36). Reuses the existing session endpoints exactly — POST /api/sessions
// to create, PATCH /api/sessions/[id] to edit — so conflict/capacity/version
// checks never diverge from the admin Schedule tab's own form.
export function SessionDialog({
  open,
  onOpenChange,
  versionId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionId: number | null;
  initial: SessionFormValues | null;
  onSaved: () => void;
}) {
  const [ref, setRef] = useState<RefData | null>(null);
  const [form, setForm] = useState<SessionFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [freeRooms, setFreeRooms] = useState<RefRoom[] | null>(null);
  const [freeRoomsLoading, setFreeRoomsLoading] = useState(false);

  useEffect(() => {
    if (open && !ref) {
      fetch("/api/reference")
        .then((r) => r.json())
        .then((json) => { if (json.ok) setRef(json.data); });
    }
  }, [open, ref]);

  useEffect(() => {
    if (open && initial) {
      setForm(initial);
      setError(null);
    }
    if (!open) {
      setFreeRooms(null);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open || !form?.day || !form.timeSlotId || !versionId) {
      setFreeRooms(null);
      return;
    }
    setFreeRoomsLoading(true);
    fetch(`/api/admin/free-rooms?day=${form.day}&timeSlotId=${form.timeSlotId}&versionId=${versionId}`)
      .then((r) => r.json())
      .then((json) => { if (json.ok) setFreeRooms(json.data); })
      .finally(() => setFreeRoomsLoading(false));
    // Re-runs whenever day/slot change so the hint always matches the current
    // selection; the room field itself is a free choice, not constrained to this list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form?.day, form?.timeSlotId, versionId]);

  if (!form) return null;
  const isEdit = Boolean(form.id);

  function setField<K extends keyof SessionFormValues>(key: K, value: SessionFormValues[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!versionId || !form) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        day: form.day,
        timeSlotId: Number(form.timeSlotId),
        batchId: Number(form.batchId),
        section: form.section.trim() || null,
        courseId: Number(form.courseId),
        teacherId: Number(form.teacherId),
        roomId: Number(form.roomId),
        versionId,
      };
      const url = isEdit ? `/api/sessions/${form.id}` : "/api/sessions";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.ok) {
        onSaved();
        onOpenChange(false);
      } else {
        setError(json.error ?? "Failed to save.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Class" : "Add Class"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Conflicts in room, teacher, and batch, and room capacity are checked automatically."
              : "Fill in the class details. Conflicts and room capacity are checked automatically."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Day">
              <select required value={form.day} onChange={(e) => setField("day", e.target.value)} className={selectClass}>
                {ref?.days.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Time Slot">
              <select required value={form.timeSlotId} onChange={(e) => setField("timeSlotId", e.target.value)} className={selectClass}>
                <option value="">Select slot</option>
                {ref?.timeSlots.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Batch">
              <select required value={form.batchId} onChange={(e) => setField("batchId", e.target.value)} className={selectClass}>
                <option value="">Select batch</option>
                {ref?.batches.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.semester} sem</option>)}
              </select>
            </Field>
            <Field label="Section (optional)">
              <input
                type="text"
                value={form.section}
                onChange={(e) => setField("section", e.target.value)}
                placeholder="e.g. Sec 1"
                className={selectClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Course">
              <select required value={form.courseId} onChange={(e) => setField("courseId", e.target.value)} className={selectClass}>
                <option value="">Select course</option>
                <optgroup label="── Theory">
                  {ref?.courses.filter((c) => c.type === "THEORY").map((c) => (
                    <option key={c.id} value={c.id}>{c.code} (Theory)</option>
                  ))}
                </optgroup>
                <optgroup label="── Lab">
                  {ref?.courses.filter((c) => c.type === "LAB").map((c) => (
                    <option key={c.id} value={c.id}>{c.code} (Lab)</option>
                  ))}
                </optgroup>
              </select>
            </Field>
            <Field label="Teacher">
              <select required value={form.teacherId} onChange={(e) => setField("teacherId", e.target.value)} className={selectClass}>
                <option value="">Select teacher</option>
                {ref?.teachers.map((t) => <option key={t.id} value={t.id}>{t.initials} — {t.name}</option>)}
              </select>
            </Field>
            <Field label="Room">
              <select required value={form.roomId} onChange={(e) => setField("roomId", e.target.value)} className={selectClass}>
                <option value="">Select room</option>
                {ref?.rooms.map((r) => <option key={r.id} value={r.id}>Room {r.name} (cap {r.capacity})</option>)}
              </select>
            </Field>
          </div>

          {form.day && form.timeSlotId && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Free rooms for {form.day}, this slot
              </label>
              <div className="mt-2">
                {freeRoomsLoading ? (
                  <p className="text-xs text-slate">Searching…</p>
                ) : freeRooms && freeRooms.length === 0 ? (
                  <p className="text-xs text-cancelled">No rooms are free at this day &amp; time.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {freeRooms?.map((r) => {
                      const selected = form.roomId === String(r.id);
                      return (
                        <button
                          type="button"
                          key={r.id}
                          onClick={() => setField("roomId", String(r.id))}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-confirmed/20 bg-confirmed/10 text-confirmed hover:bg-confirmed/15"
                          }`}
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
          )}

          {error && <Message type="error">{error}</Message>}

          <div className="flex justify-end gap-4 pt-2">
            <LinkButton type="button" tone="neutral" onClick={() => onOpenChange(false)}>
              Cancel
            </LinkButton>
            <Button type="submit" loading={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Class"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
