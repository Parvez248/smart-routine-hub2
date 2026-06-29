"use client";

import { useEffect, useState } from "react";

type Course = { id: number; code: string; title: string; type: string };
type Teacher = { id: number; initials: string; name: string };
type Room = { id: number; name: string; capacity: number };
type Batch = { id: number; name: string; semester: string };
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

const empty = { day: "", timeSlotId: "", batchId: "", section: "", courseId: "", teacherId: "", roomId: "" };

export default function RoutinePage() {
  const [ref, setRef] = useState<{ courses: Course[]; teachers: Teacher[]; rooms: Room[]; batches: Batch[]; timeSlots: TimeSlot[]; days: string[] } | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [form, setForm] = useState(empty);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    loadRef();
    loadSessions();
  }, []);

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
          section: form.section || null,
          courseId: Number(form.courseId),
          teacherId: Number(form.teacherId),
          roomId: Number(form.roomId),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setStatus({ type: "success", msg: "Session saved!" });
        setForm(empty);
        await loadSessions();
      } else {
        setStatus({ type: "error", msg: json.error ?? "Save failed" });
      }
    } catch {
      setStatus({ type: "error", msg: "Network error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/sessions?id=${id}`, { method: "DELETE" });
    await loadSessions();
  }

  const field = (name: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [name]: value }));

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Admin — Routine Builder</h1>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Add Class Session</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Day</label>
              <select required value={form.day} onChange={(e) => field("day", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select day</option>
                {ref?.days.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Time Slot</label>
              <select required value={form.timeSlotId} onChange={(e) => field("timeSlotId", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select slot</option>
                {ref?.timeSlots.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Batch</label>
              <select required value={form.batchId} onChange={(e) => field("batchId", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select batch</option>
                {ref?.batches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.semester} sem)</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Section <span className="text-gray-400">(optional)</span></label>
              <input type="text" value={form.section} onChange={(e) => field("section", e.target.value)}
                placeholder="e.g. Sec 1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Course</label>
              <select required value={form.courseId} onChange={(e) => field("courseId", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select course</option>
                {ref?.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} ({c.type === "LAB" ? "Lab" : "Theory"})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Teacher</label>
              <select required value={form.teacherId} onChange={(e) => field("teacherId", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select teacher</option>
                {ref?.teachers.map((t) => <option key={t.id} value={t.id}>{t.initials} — {t.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Room</label>
              <select required value={form.roomId} onChange={(e) => field("roomId", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select room</option>
                {ref?.rooms.map((r) => <option key={r.id} value={r.id}>Room {r.name} (cap {r.capacity})</option>)}
              </select>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <button type="submit" disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-6 py-2 rounded-lg text-sm transition-colors">
              {loading ? "Saving…" : "Save Session"}
            </button>
            {status && (
              <span className={`text-sm font-medium ${status.type === "success" ? "text-green-600" : "text-red-600"}`}>
                {status.msg}
              </span>
            )}
          </div>
        </form>

        {/* Sessions table */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <h2 className="text-lg font-semibold text-gray-700 px-6 py-4 border-b">Saved Sessions ({sessions.length})</h2>
          {sessions.length === 0 ? (
            <p className="text-gray-400 text-sm px-6 py-8">No sessions yet. Add one above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    {["Day", "Time", "Batch / Section", "Course", "Type", "Teacher", "Room", ""].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{s.day}</td>
                      <td className="px-4 py-3 text-gray-600">{s.timeSlot.label}</td>
                      <td className="px-4 py-3">{s.batch.name}{s.section ? ` / ${s.section}` : ""}</td>
                      <td className="px-4 py-3 font-medium">{s.course.code}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                          s.course.type === "LAB"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {s.course.type === "LAB" ? "Lab" : "Theory"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{s.teacher.initials}</td>
                      <td className="px-4 py-3">{s.room.name}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(s.id)}
                          className="text-red-400 hover:text-red-600 text-xs font-medium transition-colors">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
