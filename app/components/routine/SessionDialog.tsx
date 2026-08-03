"use client";

import { useEffect, useMemo, useState } from "react";
import { DoorOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { Message } from "@/app/components/ui/Message";
import { isValidLabStart, combineSlotLabels } from "./labMerge";

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
  // Second period's session id — present only when editing an existing
  // two-period lab (Step 37). Absent for theory classes and new labs.
  pairId?: number;
  day: string;
  timeSlotId: string;
  batchId: string;
  section: string;
  courseId: string;
  teacherId: string;
  roomId: string;
};

type ApiResult = { ok: boolean; data?: { id: number }; error?: string };

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

async function createSession(body: unknown): Promise<ApiResult> {
  const res = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}
async function patchSession(id: number, body: unknown): Promise<ApiResult> {
  const res = await fetch(`/api/sessions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}
async function deleteSession(id: number): Promise<ApiResult> {
  const res = await fetch(`/api/sessions?id=${id}`, { method: "DELETE" });
  return res.json();
}

function bodyFor(form: SessionFormValues, timeSlotId: number, versionId: number) {
  return {
    day: form.day,
    timeSlotId,
    batchId: Number(form.batchId),
    section: form.section.trim() || null,
    courseId: Number(form.courseId),
    teacherId: Number(form.teacherId),
    roomId: Number(form.roomId),
    versionId,
  };
}

// Shared create/edit dialog for admin inline editing on the Full Routine view
// (Step 36). Reuses the existing session endpoints exactly — POST /api/sessions
// to create, PATCH /api/sessions/[id] to edit — so conflict/capacity/version
// checks never diverge from the admin Schedule tab's own form.
//
// Step 37/38: a LAB course occupies two consecutive periods, stored as two
// Session rows. When the chosen course is a lab, the "time slot" field
// becomes a "starting slot" picker offering every slot whose pair doesn't
// cross the break (see labMerge.ts's isValidLabStart — not a hard-coded
// list), and save/delete always keep both rows in lockstep — see the
// handleSubmit cases below for the four course-type × had-pair transitions.
export function SessionDialog({
  open,
  onOpenChange,
  versionId,
  initial,
  onSaved,
  batchSections,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionId: number | null;
  initial: SessionFormValues | null;
  onSaved: () => void;
  // batchId → distinct Sec 1/Sec 2 values already in use for that batch, so
  // the Section field knows whether to offer Sec 1 / Sec 2 / Both Sections
  // (Step 39) or stay free-text for a batch with no sections.
  batchSections: Record<number, string[]>;
}) {
  const [ref, setRef] = useState<RefData | null>(null);
  const [form, setForm] = useState<SessionFormValues | null>(null);
  const [original, setOriginal] = useState<SessionFormValues | null>(null);
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
      setOriginal(initial);
      setError(null);
    }
    if (!open) {
      setFreeRooms(null);
    }
  }, [open, initial]);

  const selectedCourse = useMemo(
    () => ref?.courses.find((c) => String(c.id) === form?.courseId),
    [ref, form?.courseId]
  );
  const isLabSelected = selectedCourse?.type === "LAB";
  const hasSections = Boolean(form?.batchId && (batchSections[Number(form.batchId)]?.length ?? 0) > 0);

  const labStartOptions = useMemo(() => {
    if (!ref) return [];
    const allSortOrders = ref.timeSlots.map((t) => t.sortOrder);
    return ref.timeSlots
      .filter((slotA) => isValidLabStart(slotA.sortOrder, allSortOrders))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((slotA) => {
        const slotB = ref.timeSlots.find((t) => t.sortOrder === slotA.sortOrder + 1)!;
        const endTime = slotB.label.split("–")[1]?.trim() ?? slotB.label;
        return { id: slotA.id, label: `${slotA.label} (spans to ${endTime})` };
      });
  }, [ref]);

  useEffect(() => {
    if (!open || !form?.day || !form.timeSlotId || !versionId || !ref) {
      setFreeRooms(null);
      return;
    }
    const slotA = ref.timeSlots.find((t) => String(t.id) === form.timeSlotId);
    if (!slotA) {
      setFreeRooms(null);
      return;
    }
    setFreeRoomsLoading(true);
    if (isLabSelected) {
      const slotB = ref.timeSlots.find((t) => t.sortOrder === slotA.sortOrder + 1);
      if (!slotB) {
        setFreeRooms(null);
        setFreeRoomsLoading(false);
        return;
      }
      Promise.all([
        fetch(`/api/admin/free-rooms?day=${form.day}&timeSlotId=${slotA.id}&versionId=${versionId}`).then((r) => r.json()),
        fetch(`/api/admin/free-rooms?day=${form.day}&timeSlotId=${slotB.id}&versionId=${versionId}`).then((r) => r.json()),
      ])
        .then(([ja, jb]) => {
          if (ja.ok && jb.ok) {
            const idsB = new Set((jb.data as RefRoom[]).map((r) => r.id));
            setFreeRooms((ja.data as RefRoom[]).filter((r) => idsB.has(r.id)));
          }
        })
        .finally(() => setFreeRoomsLoading(false));
    } else {
      fetch(`/api/admin/free-rooms?day=${form.day}&timeSlotId=${form.timeSlotId}&versionId=${versionId}`)
        .then((r) => r.json())
        .then((json) => { if (json.ok) setFreeRooms(json.data); })
        .finally(() => setFreeRoomsLoading(false));
    }
    // Re-runs whenever day/slot/course change so the hint always matches the
    // current selection; the room field itself is a free choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form?.day, form?.timeSlotId, isLabSelected, versionId, ref]);

  if (!form) return null;
  const isEdit = Boolean(form.id);

  function setField<K extends keyof SessionFormValues>(key: K, value: SessionFormValues[K]) {
    setForm((f) => {
      if (!f) return f;
      const next = { ...f, [key]: value };
      if (key === "courseId") {
        const course = ref?.courses.find((c) => String(c.id) === value);
        if (course?.type === "LAB" && ref) {
          const allSortOrders = ref.timeSlots.map((t) => t.sortOrder);
          const slot = ref.timeSlots.find((t) => String(t.id) === next.timeSlotId);
          if (!slot || !isValidLabStart(slot.sortOrder, allSortOrders)) next.timeSlotId = "";
        }
      }
      if (key === "batchId") {
        const nowHasSections = (batchSections[Number(value)]?.length ?? 0) > 0;
        const validSectionValues = ["Sec 1", "Sec 2", "Both"];
        if (nowHasSections ? !validSectionValues.includes(next.section) : next.section !== "") {
          next.section = "";
        }
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!versionId || !form || !ref) return;
    setSubmitting(true);
    setError(null);
    try {
      const slotA = ref.timeSlots.find((t) => String(t.id) === form.timeSlotId);
      if (!slotA) {
        setError("Please choose a time slot.");
        return;
      }
      const slotB = isLabSelected ? ref.timeSlots.find((t) => t.sortOrder === slotA.sortOrder + 1) : undefined;
      if (isLabSelected && !slotB) {
        setError("This lab's second period could not be found.");
        return;
      }

      const hadPair = Boolean(form.pairId);

      async function revertPrimary() {
        if (original && form?.id) {
          const origSlot = ref!.timeSlots.find((t) => String(t.id) === original.timeSlotId);
          if (origSlot) await patchSession(form.id, bodyFor(original, origSlot.id, versionId!));
        }
      }

      if (!isEdit) {
        // CREATE
        const first = await createSession(bodyFor(form, slotA.id, versionId));
        if (!first.ok) {
          setError(first.error ?? "Failed to save.");
          return;
        }
        if (isLabSelected && slotB) {
          const second = await createSession(bodyFor(form, slotB.id, versionId));
          if (!second.ok) {
            await deleteSession(first.data!.id);
            setError(`${second.error ?? "Failed to save the second period."} The class was not added.`);
            return;
          }
        }
      } else if (isLabSelected && hadPair) {
        // Still a two-period lab — move/update both rows together.
        const firstRes = await patchSession(form.id!, bodyFor(form, slotA.id, versionId));
        if (!firstRes.ok) {
          setError(firstRes.error ?? "Failed to save.");
          return;
        }
        const secondRes = await patchSession(form.pairId!, bodyFor(form, slotB!.id, versionId));
        if (!secondRes.ok) {
          await revertPrimary();
          setError(`${secondRes.error ?? "Failed to save the second period."} The change was rolled back.`);
          return;
        }
      } else if (isLabSelected && !hadPair) {
        // Upgrading a single-period class into a two-period lab.
        const firstRes = await patchSession(form.id!, bodyFor(form, slotA.id, versionId));
        if (!firstRes.ok) {
          setError(firstRes.error ?? "Failed to save.");
          return;
        }
        const secondRes = await createSession(bodyFor(form, slotB!.id, versionId));
        if (!secondRes.ok) {
          await revertPrimary();
          setError(`${secondRes.error ?? "Failed to save the second period."} The change was rolled back.`);
          return;
        }
      } else if (!isLabSelected && hadPair) {
        // Downgrading a lab into a single-period class — drop the second row.
        const firstRes = await patchSession(form.id!, bodyFor(form, slotA.id, versionId));
        if (!firstRes.ok) {
          setError(firstRes.error ?? "Failed to save.");
          return;
        }
        const delRes = await deleteSession(form.pairId!);
        if (!delRes.ok) {
          await revertPrimary();
          setError("Failed to remove the class's second period. The change was rolled back.");
          return;
        }
      } else {
        // Ordinary single-period edit.
        const res = await patchSession(form.id!, bodyFor(form, slotA.id, versionId));
        if (!res.ok) {
          setError(res.error ?? "Failed to save.");
          return;
        }
      }

      onSaved();
      onOpenChange(false);
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
            <Field label={isLabSelected ? "Starting Slot" : "Time Slot"}>
              {isLabSelected ? (
                <select required value={form.timeSlotId} onChange={(e) => setField("timeSlotId", e.target.value)} className={selectClass}>
                  <option value="">Select starting slot</option>
                  {labStartOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              ) : (
                <select required value={form.timeSlotId} onChange={(e) => setField("timeSlotId", e.target.value)} className={selectClass}>
                  <option value="">Select slot</option>
                  {ref?.timeSlots.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              )}
            </Field>
            <Field label="Batch">
              <select required value={form.batchId} onChange={(e) => setField("batchId", e.target.value)} className={selectClass}>
                <option value="">Select batch</option>
                {ref?.batches.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.semester} sem</option>)}
              </select>
            </Field>
            <Field label={hasSections ? "Section" : "Section (optional)"}>
              {hasSections ? (
                <select required value={form.section} onChange={(e) => setField("section", e.target.value)} className={selectClass}>
                  <option value="">Select section</option>
                  <option value="Sec 1">Sec 1</option>
                  <option value="Sec 2">Sec 2</option>
                  <option value="Both">Both Sections</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={form.section}
                  onChange={(e) => setField("section", e.target.value)}
                  placeholder="e.g. Sec 1"
                  className={selectClass}
                />
              )}
            </Field>
          </div>

          {isLabSelected && (
            <p className="text-xs text-slate -mt-2">
              This is a lab — it will occupy both periods of the slot above.
            </p>
          )}
          {form.section === "Both" && (
            <p className="text-xs text-slate -mt-2">
              This class is taught to both sections together — it will span both section rows.
            </p>
          )}

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
                Free rooms for {form.day}, {isLabSelected ? "both periods" : "this slot"}
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
