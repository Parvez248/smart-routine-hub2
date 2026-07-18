"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { Table } from "@/app/components/ui/Table";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type Room = { id: number; name: string; capacity: number };
type RoomForm = { name: string; capacity: string };

const emptyForm: RoomForm = { name: "", capacity: "" };

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoadingState] = useState(true);
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
    setLoadingState(false);
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
    <>
      <PageHeader
        title="Rooms"
        description="Manage the rooms available for scheduling classes."
        action={
          <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-3 py-1 rounded-full">
            {rooms.length} rooms
          </span>
        }
      />

      <Card>
        <CardHeader title="Add Room" accent />
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

          {status && <Message type={status.type}>{status.msg}</Message>}

          <div className="flex justify-end">
            <Button type="submit" loading={submitting}>
              {submitting ? "Adding…" : "Add Room"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title={<>Rooms <span className="ml-2 text-sm font-normal text-gray-400">{rooms.length}</span></>} />

        {loading ? (
          <Loading />
        ) : rooms.length === 0 ? (
          <EmptyState icon="🏫" message="No rooms yet. Add one above." />
        ) : (
          <Table headers={["Name", "Capacity", ""]}>
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
                    <LinkButton tone="primary" loading={editSubmitting} onClick={() => handleEditSubmit(r.id)} className="mr-3">
                      Save
                    </LinkButton>
                    <LinkButton tone="neutral" onClick={() => setEditingId(null)}>
                      Cancel
                    </LinkButton>
                  </td>
                </tr>
              ) : (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-5 py-3.5 font-semibold text-gray-800">Room {r.name}</td>
                  <td className="px-5 py-3.5 text-gray-600">{r.capacity}</td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <LinkButton tone="primary" muted revealOnHover onClick={() => startEdit(r)} className="mr-3">
                      Edit
                    </LinkButton>
                    <LinkButton tone="danger" muted revealOnHover loading={deleteId === r.id} onClick={() => handleDelete(r.id)}>
                      {deleteId === r.id ? "Deleting…" : "Delete"}
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
