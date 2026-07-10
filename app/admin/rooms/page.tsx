"use client";

import { useEffect, useState } from "react";
import AdminNav from "../AdminNav";

type Room = { id: number; name: string; capacity: number };
type RoomForm = { name: string; capacity: string };

const emptyForm: RoomForm = { name: "", capacity: "" };

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [form, setForm] = useState<RoomForm>(emptyForm);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<RoomForm>(emptyForm);
  const [editSubmitting, setEditSubmitting] = useState(false);

  async function loadRooms() {
    const res = await fetch("/api/admin/rooms");
    const json = await res.json();
    if (json.ok) setRooms(json.data);
  }

  useEffect(() => { loadRooms(); }, []);

  function flash(type: "success" | "error", msg: string) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Room added.");
        setForm(emptyForm);
        await loadRooms();
      } else {
        flash("error", json.error ?? "Failed to add room.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(room: Room) {
    setEditingId(room.id);
    setEditForm({ name: room.name, capacity: String(room.capacity) });
  }

  async function handleEditSubmit(id: number) {
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/admin/rooms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Room updated.");
        setEditingId(null);
        await loadRooms();
      } else {
        flash("error", json.error ?? "Failed to update room.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this room? This cannot be undone.")) return;
    setDeleteId(id);
    try {
      const res = await fetch(`/api/admin/rooms/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Room deleted.");
        await loadRooms();
      } else {
        flash("error", json.error ?? "Failed to delete room.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">SmartRoutineHub</h1>
            <p className="text-xs text-gray-400 mt-0.5">Admin · Manage Rooms</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-3 py-1 rounded-full">
              {rooms.length} rooms
            </span>
            <AdminNav />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Add form card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-white">
            <h2 className="text-base font-semibold text-gray-800">Add Room</h2>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. 402"
                  className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Capacity <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                  placeholder="e.g. 40"
                  className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>

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
                disabled={submitting}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors shadow-sm"
              >
                {submitting ? "Adding…" : "Add Room"}
              </button>
            </div>
          </form>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">
              Rooms <span className="ml-2 text-sm font-normal text-gray-400">{rooms.length}</span>
            </h2>
          </div>

          {rooms.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-gray-300 text-4xl mb-3">🏫</p>
              <p className="text-gray-400 text-sm">No rooms yet. Add one above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wide">
                    <th className="px-5 py-3 text-left font-semibold">Name</th>
                    <th className="px-5 py-3 text-left font-semibold">Capacity</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rooms.map((r) =>
                    editingId === r.id ? (
                      <tr key={r.id} className="bg-indigo-50/40">
                        <td className="px-5 py-3">
                          <input
                            value={editForm.name}
                            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                            className="w-full border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <input
                            type="number"
                            min={1}
                            value={editForm.capacity}
                            onChange={(e) => setEditForm((f) => ({ ...f, capacity: e.target.value }))}
                            className="w-full border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleEditSubmit(r.id)}
                            disabled={editSubmitting}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 disabled:opacity-50 mr-3"
                          >
                            {editSubmitting ? "Saving…" : "Save"}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-xs font-semibold text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-5 py-3.5 font-semibold text-gray-800">Room {r.name}</td>
                        <td className="px-5 py-3.5 text-gray-600">{r.capacity}</td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => startEdit(r)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold text-gray-400 hover:text-indigo-600 mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(r.id)}
                            disabled={deleteId === r.id}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-xs font-semibold text-gray-400 hover:text-red-500 disabled:opacity-50"
                          >
                            {deleteId === r.id ? "Deleting…" : "Delete"}
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
