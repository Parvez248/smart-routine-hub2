"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { Table } from "@/app/components/ui/Table";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

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

const DAY_ORDER = ["Sat", "Sun", "Mon", "Tues", "Wed"];
const empty = { day: "", timeSlotId: "", batchId: "", section: "", courseId: "", teacherId: "", roomId: "" };

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
      type === "LAB" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
    }`}>
      {type === "LAB" ? "Lab" : "Theory"}
    </span>
  );
}

function Select({
  label, required, value, onChange, children,
}: {
  label: string; required?: boolean; value: string;
  onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
      >
        {children}
      </select>
    </div>
  );
}

export default function RoutinePage() {
  const [ref, setRef] = useState<RefData | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterDay, setFilterDay] = useState("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [statusActingId, setStatusActingId] = useState<number | null>(null);

  const [freeDay, setFreeDay] = useState("");
  const [freeSlotId, setFreeSlotId] = useState("");
  const [freeRooms, setFreeRooms] = useState<Room[] | null>(null);
  const [freeLoading, setFreeLoading] = useState(false);

  const [versions, setVersions] = useState<Version[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");

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

  const filtered = filterDay === "all"
    ? sessions
    : sessions.filter((s) => s.day === filterDay);

  const stats = {
    total: sessions.length,
    lab: sessions.filter((s) => s.course.type === "LAB").length,
    theory: sessions.filter((s) => s.course.type === "THEORY").length,
    days: new Set(sessions.map((s) => s.day)).size,
  };

  return (
    <>
      <PageHeader
        title="Routine Builder"
        description="Conflicts in room, teacher, and batch, and room capacity are checked automatically."
        action={
          <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-3 py-1 rounded-full">
            {sessions.length} sessions
          </span>
        }
      />

      {/* Version selector */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Version</label>
          <select
            value={selectedVersionId}
            onChange={(e) => setSelectedVersionId(e.target.value)}
            className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          >
            {versions.length === 0 && <option value="">No versions yet</option>}
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}{v.isPublished ? " (Published)" : ""} — {v.sessionCount} sessions
              </option>
            ))}
          </select>
        </div>
        <Link href="/admin/versions" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
          Manage versions →
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Sessions", value: stats.total, color: "text-gray-800" },
          { label: "Theory Classes", value: stats.theory, color: "text-sky-600" },
          { label: "Lab Classes",    value: stats.lab,    color: "text-violet-600" },
          { label: "Days Covered",   value: `${stats.days} / 5`, color: "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
            <p className="text-xs text-gray-400 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Free room finder */}
      <Card>
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
              <p className="text-sm text-gray-400">No rooms are free at this day &amp; time.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {freeRooms.map((r) => (
                  <span key={r.id} className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full">
                    Room {r.name} (cap {r.capacity})
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Form card */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-800">
              {editingId ? "Edit Session" : "Add New Session"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
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
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Section <span className="text-gray-300 normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={form.section}
                onChange={(e) => field("section", e.target.value)}
                placeholder="e.g. Sec 1"
                className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
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

      {/* Sessions table */}
      <Card>
        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-800">
            Saved Sessions
            <span className="ml-2 text-sm font-normal text-gray-400">
              {filtered.length === sessions.length ? sessions.length : `${filtered.length} of ${sessions.length}`}
            </span>
          </h2>

          {/* Day filter tabs */}
          <div className="flex gap-1 flex-wrap">
            {["all", ...DAY_ORDER].map((d) => (
              <button
                key={d}
                onClick={() => setFilterDay(d)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  filterDay === d
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {d === "all" ? "All" : d}
              </button>
            ))}
          </div>
        </div>

        {sessionsLoading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="📋"
            message={sessions.length === 0 ? "No sessions yet. Add one above." : `No sessions on ${filterDay}.`}
          />
        ) : (
          <Table headers={["Day", "Time Slot", "Batch", "Course", "Type", "Teacher", "Room", ""]}>
            {filtered.map((s) => {
              const cancelled = s.status === "CANCELLED";
              return (
                <tr
                  key={s.id}
                  className={`hover:bg-slate-50 transition-colors group ${cancelled ? "bg-gray-50/60 opacity-60" : ""}`}
                >
                  <td className="px-5 py-3.5">
                    <span className="font-semibold text-gray-700">{s.day}</span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{s.timeSlot.label}</td>
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-gray-700">{s.batch.name}</span>
                    {s.section && (
                      <span className="ml-1.5 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                        {s.section}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-gray-800">
                    {s.course.code}
                    {cancelled && (
                      <span className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        Cancelled
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <TypeBadge type={s.course.type} />
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-medium text-gray-700">{s.teacher.initials}</span>
                    <span className="ml-1.5 text-xs text-gray-400 hidden sm:inline">{s.teacher.name}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      <span className="font-medium">{s.room.name}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
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
                    >
                      {deleteId === s.id ? "…" : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </LinkButton>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </>
  );
}
