"use client";

// The exam add/edit dialog (Step 49) — the only place an Exam is written
// from the UI. Create posts to /api/admin/exam-terms/[termId]/exams, edit
// patches /api/admin/exams/[id]; both run the same checkExamConflicts on
// the server, so nothing here is a substitute for that check. What the
// dialog does locally is only to save the admin a round trip: the seating
// readout and the free-room chips.
//
// Unlike a class, an exam has no day-of-week and no TimeSlot: it has a
// calendar date (Thursdays and Saturdays included), its own start/end time,
// and one or more rooms whose capacities add up.
import { useEffect, useMemo, useState } from "react";
import { DoorOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { Message } from "@/app/components/ui/Message";
import { courseOptionLabel } from "@/app/components/routine/RowBadges";
import { sectionOptionsFor, sectionOptionLabel, studentsInSection } from "@/lib/ui/sections";
import { EXAM_TIME_PRESETS } from "@/lib/ui/examTime";
import type { ExamTypeValue } from "@/lib/ui/examType";

type RefCourse = { id: number; code: string; title: string; type: string };
type RefRoom = { id: number; name: string; capacity: number };
type RefBatch = { id: number; name: string; semester: string; sectionCount: number; studentCount: number };

type RefData = { courses: RefCourse[]; rooms: RefRoom[]; batches: RefBatch[] };

export type ExamFormValues = {
  id?: number;
  type: ExamTypeValue;
  courseId: string;
  batchId: string;
  section: string;
  date: string;
  startTime: string;
  endTime: string;
  roomIds: number[];
};

type ApiResult = { ok: boolean; error?: string; errors?: string[]; warnings?: string[] };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full border border-border bg-surface rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function ExamDialog({
  open,
  onOpenChange,
  termId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  termId: number;
  initial: ExamFormValues | null;
  onSaved: (warnings: string[]) => void;
}) {
  const [ref, setRef] = useState<RefData | null>(null);
  const [form, setForm] = useState<ExamFormValues | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // null = not checked yet for the current date/time; a Set = the rooms that
  // were free when checked. Cleared whenever date or time changes so the
  // chips can never show a stale answer.
  const [freeRoomIds, setFreeRoomIds] = useState<Set<number> | null>(null);
  const [freeRoomsLoading, setFreeRoomsLoading] = useState(false);

  const isEdit = Boolean(initial?.id);

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
      setErrors([]);
    }
    if (!open) setFreeRoomIds(null);
  }, [open, initial]);

  const selectedBatch = useMemo(
    () => ref?.batches.find((b) => String(b.id) === form?.batchId),
    [ref, form?.batchId]
  );

  // Same rule as the class routine (Step 50): the section field exists only
  // for a batch that really has two sections, and then it's a dropdown of
  // its own options — never free text.
  const sectionOptions = sectionOptionsFor(selectedBatch?.sectionCount ?? 1);
  const hasSections = sectionOptions.length > 0;

  const selectedRooms = useMemo(
    () => (ref && form ? ref.rooms.filter((r) => form.roomIds.includes(r.id)) : []),
    [ref, form]
  );
  const seats = selectedRooms.reduce((sum, r) => sum + r.capacity, 0);
  const sitting = selectedBatch ? studentsInSection(selectedBatch, form?.section || null) : 0;
  const shortOnSeats = sitting > 0 && selectedRooms.length > 0 && seats < sitting;

  const timesValid = Boolean(form?.date && form?.startTime && form?.endTime && form.startTime < form.endTime);

  function setField<K extends keyof ExamFormValues>(key: K, value: ExamFormValues[K]) {
    setForm((f) => {
      if (!f) return f;
      const next = { ...f, [key]: value };
      // Switching batch can invalidate the section (a sectioned batch's
      // "Sec 1" means nothing on an unsectioned one), so reset it.
      if (key === "batchId") next.section = "";
      return next;
    });
    if (key === "date" || key === "startTime" || key === "endTime") setFreeRoomIds(null);
  }

  function toggleRoom(roomId: number) {
    setForm((f) =>
      f
        ? { ...f, roomIds: f.roomIds.includes(roomId) ? f.roomIds.filter((id) => id !== roomId) : [...f.roomIds, roomId] }
        : f
    );
  }

  function applyPreset(startTime: string, endTime: string) {
    setForm((f) => (f ? { ...f, startTime, endTime } : f));
    setFreeRoomIds(null);
  }

  async function checkFreeRooms() {
    if (!form || !timesValid) return;
    setFreeRoomsLoading(true);
    try {
      const params = new URLSearchParams({
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
      });
      if (form.id) params.set("excludeExamId", String(form.id));
      const res = await fetch(`/api/admin/exams/free-rooms?${params.toString()}`);
      const json = await res.json();
      if (json.ok) setFreeRoomIds(new Set((json.data as RefRoom[]).map((r) => r.id)));
    } catch {
      // Non-fatal: the chips simply stay un-annotated and the server still
      // rejects a double-booked room on save.
    } finally {
      setFreeRoomsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setErrors([]);
    setSubmitting(true);

    const body = {
      type: form.type,
      courseId: Number(form.courseId),
      batchId: Number(form.batchId),
      section: form.section.trim() || null,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      roomIds: form.roomIds,
    };

    try {
      const res = await fetch(
        form.id ? `/api/admin/exams/${form.id}` : `/api/admin/exam-terms/${termId}/exams`,
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json: ApiResult = await res.json();
      if (json.ok) {
        onSaved(json.warnings ?? []);
        onOpenChange(false);
      } else {
        setErrors(json.errors?.length ? json.errors : [json.error ?? "Failed to save exam."]);
      }
    } catch {
      setErrors(["Network error. Please try again."]);
    } finally {
      setSubmitting(false);
    }
  }

  if (!form) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Exam" : "Add Exam"}</DialogTitle>
          <DialogDescription>
            Batch, room and duplicate clashes — and whether the rooms seat the batch — are checked automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Exam">
              <select
                required
                value={form.type}
                onChange={(e) => setField("type", e.target.value as ExamTypeValue)}
                className={inputClass}
              >
                <option value="MIDTERM">Midterm</option>
                <option value="FINAL">Final</option>
              </select>
            </Field>

            <Field label="Batch">
              <select required value={form.batchId} onChange={(e) => setField("batchId", e.target.value)} className={inputClass}>
                <option value="">Select batch</option>
                {ref?.batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} — {b.semester} sem</option>
                ))}
              </select>
            </Field>

            {hasSections && (
              <Field label="Section">
                <select required value={form.section} onChange={(e) => setField("section", e.target.value)} className={inputClass}>
                  <option value="">Select section</option>
                  {sectionOptions.map((value) => (
                    <option key={value} value={value}>{sectionOptionLabel(value)}</option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Date">
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setField("date", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Course">
            <select required value={form.courseId} onChange={(e) => setField("courseId", e.target.value)} className={inputClass}>
              <option value="">Select course</option>
              {ref?.courses.map((c) => (
                <option key={c.id} value={c.id}>{courseOptionLabel(c)}</option>
              ))}
            </select>
          </Field>

          <div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start Time">
                <input
                  type="time"
                  required
                  value={form.startTime}
                  onChange={(e) => setField("startTime", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="End Time">
                <input
                  type="time"
                  required
                  value={form.endTime}
                  onChange={(e) => setField("endTime", e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            {/* The slots this department actually uses — one click instead of
                typing two times. Any other span is still allowed. */}
            <div className="flex flex-wrap gap-2 mt-2">
              {EXAM_TIME_PRESETS.map((p) => {
                const active = form.startTime === p.startTime && form.endTime === p.endTime;
                return (
                  <button
                    type="button"
                    key={p.label}
                    onClick={() => applyPreset(p.startTime, p.endTime)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Rooms <span className="text-cancelled">*</span>
              </label>
              <LinkButton
                type="button"
                tone="primary"
                loading={freeRoomsLoading}
                disabled={!timesValid}
                onClick={checkFreeRooms}
              >
                Check free rooms
              </LinkButton>
            </div>

            {/* Every room is selectable; after a check, the ones already
                hosting an overlapping exam are marked. An exam can span
                several rooms, so this is a multi-select, and the seating
                line below adds their capacities up. */}
            <div className="flex flex-wrap gap-2 mt-2">
              {ref?.rooms.map((r) => {
                const selected = form.roomIds.includes(r.id);
                const busy = freeRoomIds !== null && !freeRoomIds.has(r.id);
                return (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => toggleRoom(r.id)}
                    title={busy ? "Already booked for another exam at this time" : undefined}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : busy
                          ? "border-cancelled/20 bg-cancelled/10 text-cancelled hover:bg-cancelled/15"
                          : freeRoomIds !== null
                            ? "border-confirmed/20 bg-confirmed/10 text-confirmed hover:bg-confirmed/15"
                            : "border-border bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <DoorOpen className="size-3.5" aria-hidden="true" />
                    Room {r.name} (cap {r.capacity})
                  </button>
                );
              })}
            </div>

            {selectedRooms.length > 0 && (
              <p className={`text-xs mt-2 font-data ${shortOnSeats ? "text-cancelled" : "text-slate"}`}>
                {seats} seats selected
                {sitting > 0
                  ? ` · ${sitting} students sitting${shortOnSeats ? " — add another room" : ""}`
                  : " · batch has no student count set"}
              </p>
            )}
          </div>

          {errors.length > 0 && <Message type="error">{errors.join(" ")}</Message>}

          <div className="flex justify-end gap-4 pt-2">
            <LinkButton type="button" tone="neutral" onClick={() => onOpenChange(false)}>
              Cancel
            </LinkButton>
            <Button type="submit" loading={submitting} disabled={form.roomIds.length === 0}>
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Exam"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
