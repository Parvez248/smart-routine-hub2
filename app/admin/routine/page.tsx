"use client";

import { useEffect, useState } from "react";

type Course   = { id: number; code: string; title: string; type: string };
type Teacher  = { id: number; initials: string; name: string };
type Room     = { id: number; name: string; capacity: number };
type Batch    = { id: number; name: string; semester: string };
type TimeSlot = { id: number; label: string; sortOrder: number };

type SessionRow = {
  id: number;
  day: string;
  section: string | null;
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
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterDay, setFilterDay] = useState("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  async function loadRef() {
    const res = await fetch("/api/reference");
    const json = await res.json();
    if (json.ok) setRef(json.data);
  }

  async function loadSessions() {
    const res = await fetch("/api/sessions");
    const json = await res.json();
    if (json.ok) setSessions(json.data);
  }

  useEffect(() => { loadRef(); loadSessions(); }, []);

  const field = (name: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [name]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day: form.day,
          timeSlotId: Number(form.timeSlotId),
          batchId: Number(form.batchId),
          section: form.section.trim() || null,
          courseId: Number(form.courseId),
          teacherId: Number(form.teacherId),
          roomId: Number(form.roomId),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setStatus({ type: "success", msg: "Session added successfully." });
        setForm(empty);
        await loadSessions();
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

  async function handleDelete(id: number) {
    setDeleteId(id);
    await fetch(`/api/sessions?id=${id}`, { method: "DELETE" });
    await loadSessions();
    setDeleteId(null);
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
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">SmartRoutineHub</h1>
            <p className="text-xs text-gray-400 mt-0.5">Admin · Routine Builder</p>
          </div>
          <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-3 py-1 rounded-full">
            {sessions.length} sessions
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

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

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
            <h2 className="text-base font-semibold text-gray-800">Add New Session</h2>
            <p className="text-xs text-gray-400 mt-0.5">Conflicts in room, teacher, and batch are checked automatically.</p>
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

            {/* Status banner */}
            {status && (
              <div className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${
                status.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>
                <span className="text-base leading-none mt-0.5">
                  {status.type === "success" ? "✓" : "⚠"}
                </span>
                <span>{status.msg}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors shadow-sm"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Saving…
                  </>
                ) : "Save Session"}
              </button>
            </div>
          </form>
        </div>

        {/* Sessions table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
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

          {filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-gray-300 text-4xl mb-3">📋</p>
              <p className="text-gray-400 text-sm">
                {sessions.length === 0 ? "No sessions yet. Add one above." : `No sessions on ${filterDay}.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wide">
                    <th className="px-5 py-3 text-left font-semibold">Day</th>
                    <th className="px-5 py-3 text-left font-semibold">Time Slot</th>
                    <th className="px-5 py-3 text-left font-semibold">Batch</th>
                    <th className="px-5 py-3 text-left font-semibold">Course</th>
                    <th className="px-5 py-3 text-left font-semibold">Type</th>
                    <th className="px-5 py-3 text-left font-semibold">Teacher</th>
                    <th className="px-5 py-3 text-left font-semibold">Room</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
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
                      <td className="px-5 py-3.5 font-semibold text-gray-800">{s.course.code}</td>
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
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={deleteId === s.id}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 disabled:opacity-50 p-1 rounded"
                          title="Delete session"
                        >
                          {deleteId === s.id ? (
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
