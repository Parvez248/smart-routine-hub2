"use client";

// The exam add/edit dialog — the only place an Exam is written from the UI.
// Create posts to /api/admin/exam-terms/[termId]/exams, edit patches
// /api/admin/exams/[id]; both run the same checkExamConflicts on the server,
// so nothing here is a substitute for that check. What the dialog does
// locally is save the admin a round trip: the live seat arithmetic and the
// room-availability list.
//
// Step 49b: an exam no longer has free-form times. It belongs to the day's
// morning or afternoon sitting, which fills the start time from the term's
// own setting and the end time from the exam's duration (both still
// editable). Rooms are shared — several batches sit in the Hall Room at
// once — so the room list shows seats left rather than hiding rooms as
// "booked", and each chosen room carries how many of this exam's students
// sit there.
import { useCallback, useEffect, useMemo, useState } from "react";
import { DoorOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { courseOptionLabel } from "@/app/components/routine/RowBadges";
import { sectionOptionsFor, sectionOptionLabel, studentsInSection } from "@/lib/ui/sections";
import { addMinutes, examDurationMinutes, defaultTimesFor, sittingTimeError } from "@/lib/ui/examTime";
import { EXAM_SITTINGS, EXAM_SITTING_LABELS } from "@/lib/ui/examType";
import type { ExamSittingValue, ExamTypeValue } from "@/lib/ui/examType";
import { roomLabel } from "@/lib/ui/rooms";

type RefCourse = { id: number; code: string; title: string; type: string };
type RefBatch = { id: number; name: string; semester: string; sectionCount: number; studentCount: number };
type RefData = { courses: RefCourse[]; batches: RefBatch[] };

type RoomAvailability = {
  id: number;
  name: string;
  capacity: number;
  seatsUsed: number;
  seatsLeft: number;
  hasUnknownSeats: boolean;
  occupants: { batchName: string; courseCode: string; seats: number | null }[];
};

export type ExamRoomValue = { roomId: number; seats: string };

export type ExamFormValues = {
  id?: number;
  type: ExamTypeValue;
  sitting: ExamSittingValue;
  courseId: string;
  batchId: string;
  section: string;
  date: string;
  startTime: string;
  endTime: string;
  rooms: ExamRoomValue[];
};

export type ExamTermSettings = { id: number; morningStart: string; afternoonStart: string };

type ApiResult = { ok: boolean; error?: string; errors?: string[]; warnings?: string[] };

// Most exams in a term go to the same room (the hall), so the last set used
// is remembered per term and pre-selected for the next one.
const lastRoomsKey = (termId: number) => `routine-hub:exam-rooms:${termId}`;

function readLastRooms(termId: number): number[] {
  try {
    const raw = localStorage.getItem(lastRoomsKey(termId));
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function writeLastRooms(termId: number, roomIds: number[]) {
  try {
    localStorage.setItem(lastRoomsKey(termId), JSON.stringify(roomIds));
  } catch {
    // Private browsing or a full quota — remembering rooms is a convenience.
  }
}

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
  term,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  term: ExamTermSettings;
  initial: ExamFormValues | null;
  onSaved: (warnings: string[]) => void;
}) {
  const [ref, setRef] = useState<RefData | null>(null);
  const [form, setForm] = useState<ExamFormValues | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [availability, setAvailability] = useState<RoomAvailability[] | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

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
      // A new exam starts with the rooms last used in this term.
      const remembered = initial.id ? initial.rooms : initial.rooms.length
        ? initial.rooms
        : readLastRooms(term.id).map((roomId) => ({ roomId, seats: "" }));
      setForm({ ...initial, rooms: remembered });
      setErrors([]);
    }
  }, [open, initial, term.id]);

  const selectedBatch = useMemo(
    () => ref?.batches.find((b) => String(b.id) === form?.batchId),
    [ref, form?.batchId]
  );
  const selectedCourse = useMemo(
    () => ref?.courses.find((c) => String(c.id) === form?.courseId),
    [ref, form?.courseId]
  );

  // Same rule as the class routine: the section field exists only for a
  // batch that really has two sections, and then it's a dropdown of its own
  // options — never free text.
  const sectionOptions = sectionOptionsFor(selectedBatch?.sectionCount ?? 1);
  const hasSections = sectionOptions.length > 0;

  const sitting = selectedBatch ? studentsInSection(selectedBatch, form?.section || null) : 0;

  const loadAvailability = useCallback(async () => {
    if (!form?.date || !form?.sitting) return;
    setAvailabilityLoading(true);
    try {
      const params = new URLSearchParams({ date: form.date, sitting: form.sitting });
      if (form.id) params.set("excludeExamId", String(form.id));
      const res = await fetch(`/api/admin/exams/room-availability?${params.toString()}`);
      const json = await res.json();
      setAvailability(json.ok ? json.data : null);
    } catch {
      setAvailability(null);
    } finally {
      setAvailabilityLoading(false);
    }
  }, [form?.date, form?.sitting, form?.id]);

  // Seats left depend on the date and sitting, so the list is refreshed
  // whenever either changes rather than behind a button.
  useEffect(() => { if (open) loadAvailability(); }, [open, loadAvailability]);

  function setField<K extends keyof ExamFormValues>(key: K, value: ExamFormValues[K]) {
    setForm((f) => {
      if (!f) return f;
      const next = { ...f, [key]: value };
      // Switching batch can invalidate the section (a sectioned batch's
      // "Sec 1" means nothing on an unsectioned one), so reset it.
      if (key === "batchId") next.section = "";
      return next;
    });
  }

  // Choosing a sitting refills both times from the term's settings; changing
  // the exam kind or the course only moves the end time, so a start the
  // admin typed by hand survives.
  function chooseSitting(value: ExamSittingValue) {
    setForm((f) => {
      if (!f) return f;
      const times = defaultTimesFor(term, value, f.type, selectedCourse?.type);
      return { ...f, sitting: value, ...times };
    });
  }

  function retimeEnd(next: Partial<ExamFormValues>, courseType: string | undefined) {
    setForm((f) => {
      if (!f) return f;
      const merged = { ...f, ...next };
      const end = addMinutes(merged.startTime, examDurationMinutes(merged.type, courseType));
      return { ...merged, endTime: end ?? merged.endTime };
    });
  }

  function toggleRoom(roomId: number) {
    setForm((f) => {
      if (!f) return f;
      if (f.rooms.some((r) => r.roomId === roomId)) {
        return { ...f, rooms: f.rooms.filter((r) => r.roomId !== roomId) };
      }
      // Pre-fill the seats when this is the only room and the batch size is
      // known — the common case of a whole batch sitting in the hall.
      const seats = f.rooms.length === 0 && sitting > 0 ? String(sitting) : "";
      return { ...f, rooms: [...f.rooms, { roomId, seats }] };
    });
  }

  function setRoomSeats(roomId: number, seats: string) {
    setForm((f) =>
      f ? { ...f, rooms: f.rooms.map((r) => (r.roomId === roomId ? { ...r, seats } : r)) } : f
    );
  }

  const availabilityById = useMemo(
    () => new Map((availability ?? []).map((r) => [r.id, r])),
    [availability]
  );

  const totalSeats = (form?.rooms ?? []).reduce((sum, r) => sum + (Number(r.seats) || 0), 0);

  // Live, non-blocking notices — the same things the server would warn about,
  // shown while the admin is still typing.
  const notices: string[] = [];
  if (form) {
    for (const r of form.rooms) {
      if (r.seats.trim() === "") {
        const room = availabilityById.get(r.roomId);
        notices.push(`Seats not set for ${room ? roomLabel(room.name) : "a room"} — capacity not checked.`);
      }
    }
    if (sitting === 0 && selectedBatch) {
      notices.push(`Batch ${selectedBatch.name} has no student count set, so seat totals aren't checked.`);
    } else if (form.rooms.length > 0 && form.rooms.every((r) => r.seats.trim() !== "") && totalSeats !== sitting) {
      notices.push(`Seats add up to ${totalSeats}, but ${sitting} students sit this exam.`);
    }
  }

  const timeError = form ? sittingTimeError(form.sitting, form.startTime, form.endTime) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setErrors([]);

    if (timeError) { setErrors([timeError]); return; }
    setSubmitting(true);

    const body = {
      type: form.type,
      courseId: Number(form.courseId),
      batchId: Number(form.batchId),
      section: form.section.trim() || null,
      date: form.date,
      sitting: form.sitting,
      startTime: form.startTime,
      endTime: form.endTime,
      rooms: form.rooms.map((r) => ({
        roomId: r.roomId,
        seats: r.seats.trim() === "" ? null : Number(r.seats),
      })),
    };

    try {
      const res = await fetch(
        form.id ? `/api/admin/exams/${form.id}` : `/api/admin/exam-terms/${term.id}/exams`,
        {
          method: form.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json: ApiResult = await res.json();
      if (json.ok) {
        writeLastRooms(term.id, form.rooms.map((r) => r.roomId));
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
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Exam" : "Add Exam"}</DialogTitle>
          <DialogDescription>
            Rooms are shared between batches. A room is only full when its seats run out.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Exam">
              <select
                required
                value={form.type}
                onChange={(e) => retimeEnd({ type: e.target.value as ExamTypeValue }, selectedCourse?.type)}
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
            <select
              required
              value={form.courseId}
              onChange={(e) => {
                const course = ref?.courses.find((c) => String(c.id) === e.target.value);
                retimeEnd({ courseId: e.target.value }, course?.type);
              }}
              className={inputClass}
            >
              <option value="">Select course</option>
              {ref?.courses.map((c) => (
                <option key={c.id} value={c.id}>{courseOptionLabel(c)}</option>
              ))}
            </select>
          </Field>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sitting</label>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {EXAM_SITTINGS.map((value) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => chooseSitting(value)}
                  aria-pressed={form.sitting === value}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                    form.sitting === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {EXAM_SITTING_LABELS[value]}
                </button>
              ))}
              <span className="text-xs text-slate ml-1">
                starts {form.sitting === "MORNING" ? term.morningStart : term.afternoonStart} by default
              </span>
            </div>
          </div>

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
          {timeError && <p className="text-xs text-cancelled font-semibold">{timeError}</p>}

          <div>
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Rooms <span className="text-cancelled">*</span>
              </label>
              <span className="text-xs text-slate font-data">
                This exam: {totalSeats} seats
                {sitting > 0 ? ` · Batch size: ${sitting}` : ""}
              </span>
            </div>

            {/* Rooms are never hidden for being in use — several batches share
                the hall. Each one shows what is left in this sitting and who
                is already there. */}
            <div className="mt-2 space-y-1.5">
              {availabilityLoading && <p className="text-xs text-slate">Checking rooms…</p>}
              {!availabilityLoading && !form.date && (
                <p className="text-xs text-slate">Pick a date to see how full each room is.</p>
              )}
              {(availability ?? []).map((room) => {
                const chosen = form.rooms.find((r) => r.roomId === room.id);
                const mySeats = Number(chosen?.seats) || 0;
                const over = Boolean(chosen) && mySeats > room.seatsLeft;
                return (
                  <div
                    key={room.id}
                    className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                      chosen ? "border-primary bg-primary/5" : "border-border bg-muted/40"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleRoom(room.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground"
                    >
                      <DoorOpen className="size-3.5 text-slate" aria-hidden="true" />
                      {roomLabel(room.name)}
                    </button>
                    <span className="text-xs text-slate font-data">
                      {room.seatsLeft} of {room.capacity} left
                    </span>
                    {room.occupants.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        · {room.occupants.map((o) => `${o.batchName}${o.seats === null ? "" : ` ${o.seats}`}`).join(", ")}
                      </span>
                    )}
                    {room.hasUnknownSeats && (
                      <span className="text-xs text-pending">· some seats unknown</span>
                    )}
                    {chosen && (
                      <span className="ml-auto flex items-center gap-1.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide" htmlFor={`seats-${room.id}`}>
                          Seats
                        </label>
                        <input
                          id={`seats-${room.id}`}
                          type="number"
                          min={1}
                          value={chosen.seats}
                          onChange={(e) => setRoomSeats(room.id, e.target.value)}
                          placeholder="—"
                          className={`w-20 border rounded-lg px-2 py-1 text-sm font-data focus:outline-none focus:ring-2 focus:ring-ring ${
                            over ? "border-cancelled bg-cancelled/5 text-cancelled" : "border-border bg-surface"
                          }`}
                        />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Blocking reasons keep the dialog open; notices never do. */}
          {errors.length > 0 && (
            <div className="rounded-lg border border-cancelled/30 bg-cancelled/5 px-3 py-2 space-y-1">
              {errors.map((msg) => (
                <p key={msg} className="text-xs font-semibold text-cancelled">{msg}</p>
              ))}
            </div>
          )}
          {notices.length > 0 && (
            <div className="rounded-lg border border-pending/30 bg-pending/5 px-3 py-2 space-y-1">
              {notices.map((msg) => (
                <p key={msg} className="text-xs text-pending">{msg}</p>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-4 pt-2">
            <LinkButton type="button" tone="neutral" onClick={() => onOpenChange(false)}>
              Cancel
            </LinkButton>
            <Button type="submit" loading={submitting} disabled={form.rooms.length === 0 || Boolean(timeError)}>
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Exam"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
