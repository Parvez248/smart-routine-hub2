"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { Message } from "@/app/components/ui/Message";
import { useRoutineFilters } from "@/app/components/routine/useRoutineFilters";
import { RoutineList } from "@/app/components/routine/RoutineList";
import { RoutineTimeRail } from "@/app/components/routine/RoutineTimeRail";
import { RoutineGrid, type AddSessionContext, type CombineTarget } from "@/app/components/routine/RoutineGrid";
import { RoutineMasthead } from "@/app/components/routine/RoutineMasthead";
import { FilterCard } from "@/app/components/routine/FilterCard";
import { ViewToggle, type RoutineView } from "@/app/components/routine/ViewToggle";
import { useIsDesktop } from "@/app/components/routine/useIsDesktop";
import { SessionDialog, type SessionFormValues } from "@/app/components/routine/SessionDialog";
import { combineSlotLabels, mergeLabPairs } from "@/app/components/routine/labMerge";
import { canCombine, sectionLabel } from "@/lib/ui/sections";

type Course   = { id: number; code: string; title: string; type: string };
type Teacher  = { id: number; initials: string; name: string };
type Room     = { id: number; name: string; capacity: number };
type Batch    = { id: number; name: string; semester: string };
type TimeSlot = { id: number; label: string; sortOrder: number };

type SessionRow = {
  id: number;
  day: string;
  section: string | null;
  status: string;
  course: Course;
  teacher: Teacher;
  room: Room;
  batch: Batch;
  timeSlot: TimeSlot;
  movedTo: { day: string; timeSlot: TimeSlot | null; room: Room | null; date: string | null } | null;
};

type RefData = {
  courses: Course[];
  teachers: Teacher[];
  rooms: Room[];
  batches: Batch[];
  timeSlots: TimeSlot[];
  days: string[];
};

type Version = {
  id: number;
  name: string;
  isPublished: boolean;
  effectiveDate: string | null;
  sessionCount: number;
};

const empty = { day: "", timeSlotId: "", batchId: "", section: "", courseId: "", teacherId: "", roomId: "" };

function Select({
  label, required, value, onChange, children,
}: {
  label: string; required?: boolean; value: string;
  onChange: (v: string) => void; children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}{required && <span className="text-cancelled ml-0.5">*</span>}
      </label>
      <select
        id={id}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-border bg-muted rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
      >
        {children}
      </select>
    </div>
  );
}

export default function ScheduleSection() {
  const [ref, setRef] = useState<RefData | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [statusActingId, setStatusActingId] = useState<number | null>(null);
  const [combiningId, setCombiningId] = useState<number | null>(null);

  const [freeDay, setFreeDay] = useState("");
  const [freeSlotId, setFreeSlotId] = useState("");
  const [freeRooms, setFreeRooms] = useState<Room[] | null>(null);
  const [freeLoading, setFreeLoading] = useState(false);

  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [view, setView] = useState<RoutineView>("grid");
  const isDesktop = useIsDesktop();
  const effectiveView: RoutineView = view === "table" ? "table" : isDesktop ? view : "rail";

  // Inline edit dialog (Step 36) — a second, on-grid way to add/edit/delete a
  // class, independent of the form above. Reuses the exact same endpoints.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<SessionFormValues | null>(null);

  async function loadRef() {
    const res = await fetch("/api/reference");
    const json = await res.json();
    if (json.ok) setRef(json.data);
  }

  async function loadVersions() {
    const res = await fetch("/api/admin/versions");
    const json = await res.json();
    if (json.ok) {
      setVersions(json.data);
      setSelectedVersionId((current) => {
        if (current && json.data.some((v: Version) => String(v.id) === current)) return current;
        const published = json.data.find((v: Version) => v.isPublished);
        return String((published ?? json.data[0])?.id ?? "");
      });
    }
  }

  async function loadSessions(versionId: string) {
    if (!versionId) {
      setSessions([]);
      setSessionsLoading(false);
      return;
    }
    setSessionsLoading(true);
    const res = await fetch(`/api/sessions?versionId=${versionId}`);
    const json = await res.json();
    if (json.ok) setSessions(json.data);
    setSessionsLoading(false);
  }

  useEffect(() => { loadRef(); loadVersions(); }, []);
  useEffect(() => { loadSessions(selectedVersionId); }, [selectedVersionId]);

  const field = (name: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [name]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const url = editingId ? `/api/sessions/${editingId}` : "/api/sessions";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day: form.day,
          timeSlotId: Number(form.timeSlotId),
          batchId: Number(form.batchId),
          section: form.section.trim() || null,
          courseId: Number(form.courseId),
          teacherId: Number(form.teacherId),
          roomId: Number(form.roomId),
          versionId: Number(selectedVersionId),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setStatus({ type: "success", msg: editingId ? "Session updated." : "Session added successfully." });
        setForm(empty);
        setEditingId(null);
        await loadSessions(selectedVersionId);
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus({ type: "error", msg: json.error ?? "Save failed." });
      }
    } catch {
      setStatus({ type: "error", msg: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  }

  function startEdit(s: SessionRow) {
    setEditingId(s.id);
    setForm({
      day: s.day,
      timeSlotId: String(s.timeSlot.id),
      batchId: String(s.batch.id),
      section: s.section ?? "",
      courseId: String(s.course.id),
      teacherId: String(s.teacher.id),
      roomId: String(s.room.id),
    });
    setStatus(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(empty);
    setStatus(null);
  }

  async function handleDelete(id: number) {
    setDeleteId(id);
    await fetch(`/api/sessions?id=${id}`, { method: "DELETE" });
    if (editingId === id) cancelEdit();
    await loadSessions(selectedVersionId);
    setDeleteId(null);
  }

  // `s` is always the earlier-slot session of a merged lab pair (see
  // RoutineGrid/RoutineTimeRail's merge logic), so it doubles as the
  // "starting slot" the dialog expects.
  function openInlineEdit(s: SessionRow, pair?: SessionRow) {
    setDialogInitial({
      id: s.id,
      pairId: pair?.id,
      day: s.day,
      timeSlotId: String(s.timeSlot.id),
      batchId: String(s.batch.id),
      section: s.section ?? "",
      courseId: String(s.course.id),
      teacherId: String(s.teacher.id),
      roomId: String(s.room.id),
    });
    setDialogOpen(true);
  }

  function openInlineAdd(ctx: AddSessionContext<SessionRow>) {
    setDialogInitial({
      day: ctx.day,
      timeSlotId: ctx.timeSlot ? String(ctx.timeSlot.id) : "",
      batchId: String(ctx.batch.id),
      section: ctx.section ?? "",
      courseId: "",
      teacherId: "",
      roomId: "",
    });
    setDialogOpen(true);
  }

  async function handleInlineDelete(s: SessionRow, pair?: SessionRow) {
    const label = pair
      ? `Delete ${s.course.code} (${s.day}, ${combineSlotLabels(s.timeSlot.label, pair.timeSlot.label)})? This lab covers two periods — both will be removed.`
      : `Delete ${s.course.code} (${s.day}, ${s.timeSlot.label})?`;
    if (!confirm(label)) return;
    await handleDelete(s.id);
    if (pair) await handleDelete(pair.id);
  }

  // Step 41 — merge an identical Sec 1 + Sec 2 pair into one "Both" class.
  function sessionFields(s: SessionRow, section: string | null) {
    return {
      day: s.day,
      timeSlotId: s.timeSlot.id,
      batchId: s.batch.id,
      section,
      courseId: s.course.id,
      teacherId: s.teacher.id,
      roomId: s.room.id,
      versionId: Number(selectedVersionId),
    };
  }

  async function patchSessionApi(id: number, fields: ReturnType<typeof sessionFields>) {
    const res = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    const json = await res.json();
    return { ok: res.ok && json.ok, error: json.error as string | undefined };
  }

  async function createSessionApi(fields: ReturnType<typeof sessionFields>) {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    const json = await res.json();
    return { ok: res.status === 201 && json.ok, error: json.error as string | undefined };
  }

  async function deleteSessionApi(id: number) {
    const res = await fetch(`/api/sessions?id=${id}`, { method: "DELETE" });
    return res.ok;
  }

  // One period's merge: delete the Sec 2 (partner) row, then promote the
  // Sec 1 (anchor) row to "Both". Order matters — patching the anchor to
  // Both while partner still exists would trip the existing room/teacher/
  // batch conflict checks (correctly: the two rows really would overlap
  // until partner is gone). If the patch fails after the delete already
  // succeeded, the partner is recreated so the period isn't left one row
  // short.
  async function combinePeriod(anchor: SessionRow, partner: SessionRow): Promise<void> {
    const deleted = await deleteSessionApi(partner.id);
    if (!deleted) {
      throw new Error(`Could not remove the ${sectionLabel(partner.section)} class (${partner.course.code}).`);
    }
    const patch = await patchSessionApi(anchor.id, sessionFields(anchor, "Both"));
    if (patch.ok) return;

    const restore = await createSessionApi(sessionFields(partner, partner.section));
    if (!restore.ok) {
      throw new Error(
        `Combine failed for ${anchor.course.code} and the ${sectionLabel(partner.section)} class could not be restored automatically — please recreate it manually (${partner.day}, ${partner.timeSlot.label}, ${partner.teacher.initials}, Room ${partner.room.name}).`
      );
    }
    throw new Error(patch.error ?? `Could not combine ${anchor.course.code} — restored the original two classes.`);
  }

  // Reverses one already-combined period — used to roll a lab pair back to
  // its original two rows when a later period fails, so the pair stays in
  // lockstep (both periods combined, or neither).
  async function uncombinePeriod(anchor: SessionRow, partner: SessionRow): Promise<void> {
    await patchSessionApi(anchor.id, sessionFields(anchor, anchor.section));
    const restore = await createSessionApi(sessionFields(partner, partner.section));
    if (!restore.ok) {
      throw new Error(`Rollback incomplete for ${anchor.course.code} — please check the routine manually.`);
    }
  }

  async function handleCombine(
    anchor: SessionRow,
    anchorPair: SessionRow | undefined,
    partner: SessionRow,
    partnerPair: SessionRow | undefined
  ) {
    const isLab = Boolean(anchorPair && partnerPair);
    const confirmMsg = isLab
      ? `Combine ${anchor.course.code} (${anchor.day}) into one class for both sections? Both periods of this lab will be merged.`
      : `Combine ${anchor.course.code} (${anchor.day}, ${anchor.timeSlot.label}) into one class for both sections?`;
    if (!confirm(confirmMsg)) return;

    const periods: [SessionRow, SessionRow][] = isLab
      ? [[anchor, partner], [anchorPair!, partnerPair!]]
      : [[anchor, partner]];

    setCombiningId(anchor.id);
    setStatus(null);
    const completed: [SessionRow, SessionRow][] = [];
    try {
      for (const [a, p] of periods) {
        await combinePeriod(a, p);
        completed.push([a, p]);
      }
      setStatus({ type: "success", msg: `Combined ${anchor.course.code} into one class for both sections.` });
    } catch (err) {
      for (const [a, p] of [...completed].reverse()) {
        try {
          await uncombinePeriod(a, p);
        } catch (rollbackErr) {
          console.error(rollbackErr);
        }
      }
      setStatus({ type: "error", msg: err instanceof Error ? err.message : "Combine failed." });
    } finally {
      setCombiningId(null);
      await loadSessions(selectedVersionId);
    }
  }

  async function handleToggleStatus(s: SessionRow) {
    const nextStatus = s.status === "CANCELLED" ? "ACTIVE" : "CANCELLED";
    setStatusActingId(s.id);
    try {
      const res = await fetch(`/api/sessions/${s.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (json.ok) {
        await loadSessions(selectedVersionId);
      } else {
        setStatus({ type: "error", msg: json.error ?? "Failed to update status." });
      }
    } catch {
      setStatus({ type: "error", msg: "Network error. Please try again." });
    } finally {
      setStatusActingId(null);
    }
  }

  async function handleFindFreeRooms() {
    if (!freeDay || !freeSlotId || !selectedVersionId) return;
    setFreeLoading(true);
    setFreeRooms(null);
    try {
      const res = await fetch(
        `/api/admin/free-rooms?day=${encodeURIComponent(freeDay)}&timeSlotId=${freeSlotId}&versionId=${selectedVersionId}`
      );
      const json = await res.json();
      if (json.ok) setFreeRooms(json.data);
    } finally {
      setFreeLoading(false);
    }
  }

  const filterState = useRoutineFilters(sessions, { storageKey: "admin" });
  const { filtered, totalCount, clearAll } = filterState;

  const stats = {
    total: sessions.length,
    lab: sessions.filter((s) => s.course.type === "LAB").length,
    theory: sessions.filter((s) => s.course.type === "THEORY").length,
    days: new Set(sessions.map((s) => s.day)).size,
  };

  // batchId → distinct Sec 1/Sec 2 values seen anywhere in the loaded routine
  // — tells the dialog which batches are sectioned (Step 39), from data
  // already fetched, no new query.
  const batchSections: Record<number, string[]> = {};
  for (const s of sessions) {
    if (s.section === "Sec 1" || s.section === "Sec 2") {
      const set = batchSections[s.batch.id] ?? [];
      if (!set.includes(s.section)) set.push(s.section);
      batchSections[s.batch.id] = set;
    }
  }

  // Step 41 — Sec 1 sessions (or Sec 1 lab pairs) that have an identical
  // Sec 2 counterpart in the same batch+day+slot, keyed by the Sec 1
  // session's id. Reuses mergeLabPairs (same lab-pairing logic the grid
  // and rail already use) so a two-period lab only offers Combine when
  // both periods match across the two sections.
  const combinablePairs = useMemo(() => {
    const map = new Map<number, CombineTarget<SessionRow>>();
    const groups = new Map<string, SessionRow[]>();
    for (const s of sessions) {
      if (s.section !== "Sec 1" && s.section !== "Sec 2") continue;
      if (s.status !== "ACTIVE" || s.movedTo) continue;
      const key = `${s.batch.id}|${s.day}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    for (const groupSessions of groups.values()) {
      const sec1 = groupSessions.filter((s) => s.section === "Sec 1");
      const sec2 = groupSessions.filter((s) => s.section === "Sec 2");
      if (sec1.length === 0 || sec2.length === 0) continue;
      const sec1Entries = mergeLabPairs(sec1);
      const sec2Entries = mergeLabPairs(sec2);
      for (const e1 of sec1Entries) {
        const e2 = sec2Entries.find(
          (e) => e.session.timeSlot.sortOrder === e1.session.timeSlot.sortOrder && e.span === e1.span
        );
        if (!e2) continue;
        if (!canCombine(e1.session, e2.session)) continue;
        if (e1.span === 2 && (!e1.pair || !e2.pair || !canCombine(e1.pair, e2.pair))) continue;
        map.set(e1.session.id, { partner: e2.session, partnerPair: e1.span === 2 ? e2.pair : undefined });
      }
    }
    return map;
  }, [sessions]);

  const selectedVersionName = versions.find((v) => String(v.id) === selectedVersionId)?.name ?? "—";
  const publishedVersion = versions.find((v) => v.isPublished) ?? null;

  return (
    <>
      <RoutineMasthead
        versionName={publishedVersion?.name}
        effectiveDate={publishedVersion?.effectiveDate}
        filterSummary={filterState.chips.map((c) => c.label).join(", ")}
      />

      {/* Version selector */}
      <div className="print:hidden bg-card rounded-lg border border-border px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label htmlFor="schedule-version" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Version</label>
          <select
            id="schedule-version"
            value={selectedVersionId}
            onChange={(e) => setSelectedVersionId(e.target.value)}
            className="border border-border bg-muted rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
          >
            {versions.length === 0 && <option value="">No versions yet</option>}
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}{v.isPublished ? " (Published)" : ""} — {v.sessionCount} sessions
              </option>
            ))}
          </select>
        </div>
        <Link href="/admin/routine?tab=versions" className="text-xs font-semibold text-primary hover:opacity-80">
          Manage versions →
        </Link>
      </div>

      {/* Stats row */}
      <div className="print:hidden grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Sessions", value: stats.total, color: "text-foreground" },
          { label: "Theory Classes", value: stats.theory, color: "text-muted-foreground" },
          { label: "Lab Classes",    value: stats.lab,    color: "text-primary" },
          { label: "Days Covered",   value: `${stats.days} / 5`, color: "text-confirmed" },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-lg border border-border px-5 py-4">
            <p className="text-xs text-slate font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Free room finder */}
      <Card className="print:hidden">
        <CardHeader title="Find Free Rooms" description="Pick a day and time slot to see which rooms are available." />
        <div className="p-6 flex flex-wrap items-end gap-4">
          <div className="w-40">
            <Select label="Day" value={freeDay} onChange={setFreeDay}>
              <option value="">Select day</option>
              {ref?.days.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </div>
          <div className="w-56">
            <Select label="Time Slot" value={freeSlotId} onChange={setFreeSlotId}>
              <option value="">Select slot</option>
              {ref?.timeSlots.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>
          </div>
          <Button
            type="button"
            onClick={handleFindFreeRooms}
            disabled={!freeDay || !freeSlotId}
            loading={freeLoading}
            className="px-5"
          >
            {freeLoading ? "Searching…" : "Find Free Rooms"}
          </Button>
        </div>

        {freeRooms && (
          <div className="px-6 pb-6">
            {freeRooms.length === 0 ? (
              <p className="text-sm text-slate">No rooms are free at this day &amp; time.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {freeRooms.map((r) => (
                  <span key={r.id} className="text-xs font-semibold font-data bg-confirmed/10 text-confirmed px-3 py-1.5 rounded-full">
                    Room {r.name} (cap {r.capacity})
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Form card */}
      <Card className="print:hidden">
        <div className="px-6 py-4 border-b border-border bg-primary/5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {editingId ? "Edit Session" : "Add New Session"}
            </h2>
            <p className="text-xs text-slate mt-0.5">
              Conflicts in room, teacher, and batch, and room capacity are checked automatically.
            </p>
          </div>
          {editingId && (
            <LinkButton type="button" tone="neutral" onClick={cancelEdit}>
              Cancel edit
            </LinkButton>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Row 1: Day + Time Slot + Batch + Section */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Select label="Day" required value={form.day} onChange={(v) => field("day", v)}>
              <option value="">Select day</option>
              {ref?.days.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>

            <Select label="Time Slot" required value={form.timeSlotId} onChange={(v) => field("timeSlotId", v)}>
              <option value="">Select slot</option>
              {ref?.timeSlots.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>

            <Select label="Batch" required value={form.batchId} onChange={(v) => field("batchId", v)}>
              <option value="">Select batch</option>
              {ref?.batches.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.semester} sem</option>)}
            </Select>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Section <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={form.section}
                onChange={(e) => field("section", e.target.value)}
                placeholder="e.g. Sec 1"
                className="border border-border bg-muted rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Row 2: Course + Teacher + Room */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select label="Course" required value={form.courseId} onChange={(v) => field("courseId", v)}>
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
            </Select>

            <Select label="Teacher" required value={form.teacherId} onChange={(v) => field("teacherId", v)}>
              <option value="">Select teacher</option>
              {ref?.teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.initials} — {t.name}</option>
              ))}
            </Select>

            <Select label="Room" required value={form.roomId} onChange={(v) => field("roomId", v)}>
              <option value="">Select room</option>
              {ref?.rooms.map((r) => (
                <option key={r.id} value={r.id}>Room {r.name} (cap {r.capacity})</option>
              ))}
            </Select>
          </div>

          {status && <Message type={status.type}>{status.msg}</Message>}

          <div className="flex justify-end">
            <Button type="submit" loading={loading}>
              {loading ? "Saving…" : editingId ? "Update Session" : "Save Session"}
            </Button>
          </div>
        </form>
      </Card>

      <FilterCard state={filterState} totalCount={totalCount} />

      {/* Sessions */}
      <div className="print:hidden flex items-center justify-between">
        <h2 className="font-heading text-base font-semibold text-foreground">Saved Sessions — {selectedVersionName}</h2>
        <ViewToggle value={view} onChange={setView} />
      </div>

      {(() => {
        const renderActions = (s: SessionRow) => {
          const cancelled = s.status === "CANCELLED";
          return (
            <>
              <LinkButton
                tone={cancelled ? "success" : "warning"}
                revealOnHover
                loading={statusActingId === s.id}
                onClick={() => handleToggleStatus(s)}
                className="mr-3"
              >
                {cancelled ? "Restore" : "Cancel"}
              </LinkButton>
              <LinkButton tone="primary" muted revealOnHover onClick={() => startEdit(s)} className="mr-3">
                Edit
              </LinkButton>
              <LinkButton
                tone="danger"
                muted
                revealOnHover
                loading={deleteId === s.id}
                onClick={() => handleDelete(s.id)}
                className="p-1 rounded align-middle"
                title="Delete session"
                aria-label="Delete session"
              >
                {deleteId === s.id ? "…" : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </LinkButton>
            </>
          );
        };

        return effectiveView === "grid" ? (
          <RoutineGrid
            sessions={filtered}
            loading={sessionsLoading}
            onClearFilters={clearAll}
            editable
            onEditSession={openInlineEdit}
            onDeleteSession={handleInlineDelete}
            onAddSession={openInlineAdd}
            combinablePairs={combinablePairs}
            onCombine={handleCombine}
            combiningId={combiningId}
          />
        ) : effectiveView === "rail" ? (
          <RoutineTimeRail
            sessions={filtered}
            loading={sessionsLoading}
            onClearFilters={clearAll}
            editable
            onEditSession={openInlineEdit}
            onDeleteSession={handleInlineDelete}
            onAddSession={openInlineAdd}
          />
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <RoutineList sessions={filtered} loading={sessionsLoading} onClearFilters={clearAll} renderActions={renderActions} />
          </div>
        );
      })()}

      <SessionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        versionId={selectedVersionId ? Number(selectedVersionId) : null}
        initial={dialogInitial}
        onSaved={() => loadSessions(selectedVersionId)}
        batchSections={batchSections}
      />
    </>
  );
}
