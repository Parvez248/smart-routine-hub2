"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { Table } from "@/app/components/ui/Table";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type Batch = { id: number; name: string; semester: string; studentCount: number };
type BatchForm = { name: string; semester: string; studentCount: string };

const emptyForm: BatchForm = { name: "", semester: "", studentCount: "" };

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [form, setForm] = useState<BatchForm>(emptyForm);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<BatchForm>(emptyForm);
  const [editSubmitting, setEditSubmitting] = useState(false);

  async function loadBatches() {
    const res = await fetch("/api/admin/batches");
    const json = await res.json();
    if (json.ok) setBatches(json.data);
    setLoadingState(false);
  }

  useEffect(() => { loadBatches(); }, []);

  function flash(type: "success" | "error", msg: string) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Batch added.");
        setForm(emptyForm);
        await loadBatches();
      } else {
        flash("error", json.error ?? "Failed to add batch.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(batch: Batch) {
    setEditingId(batch.id);
    setEditForm({ name: batch.name, semester: batch.semester, studentCount: String(batch.studentCount) });
  }

  async function handleEditSubmit(id: number) {
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/admin/batches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Batch updated.");
        setEditingId(null);
        await loadBatches();
      } else {
        flash("error", json.error ?? "Failed to update batch.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this batch? This cannot be undone.")) return;
    setDeleteId(id);
    try {
      const res = await fetch(`/api/admin/batches/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Batch deleted.");
        await loadBatches();
      } else {
        flash("error", json.error ?? "Failed to delete batch.");
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
        title="Batches"
        description="Manage student batches and their sizes for capacity checks."
        action={
          <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-3 py-1 rounded-full">
            {batches.length} batches
          </span>
        }
      />

      <Card>
        <CardHeader title="Add Batch" accent />
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. 28th"
                className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Semester <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.semester}
                onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))}
                placeholder="e.g. 4th"
                className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Student Count <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                required
                min={0}
                value={form.studentCount}
                onChange={(e) => setForm((f) => ({ ...f, studentCount: e.target.value }))}
                placeholder="e.g. 45"
                className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>
          </div>

          {status && <Message type={status.type}>{status.msg}</Message>}

          <div className="flex justify-end">
            <Button type="submit" loading={submitting}>
              {submitting ? "Adding…" : "Add Batch"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title={<>Batches <span className="ml-2 text-sm font-normal text-gray-400">{batches.length}</span></>} />

        {loading ? (
          <Loading />
        ) : batches.length === 0 ? (
          <EmptyState icon="🎓" message="No batches yet. Add one above." />
        ) : (
          <Table headers={["Name", "Semester", "Students", ""]}>
            {batches.map((b) =>
              editingId === b.id ? (
                <tr key={b.id} className="bg-indigo-50/40">
                  <td className="px-5 py-3">
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-5 py-3">
                    <input
                      value={editForm.semester}
                      onChange={(e) => setEditForm((f) => ({ ...f, semester: e.target.value }))}
                      className="w-full border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-5 py-3">
                    <input
                      type="number"
                      min={0}
                      value={editForm.studentCount}
                      onChange={(e) => setEditForm((f) => ({ ...f, studentCount: e.target.value }))}
                      className="w-full border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <LinkButton tone="primary" loading={editSubmitting} onClick={() => handleEditSubmit(b.id)} className="mr-3">
                      Save
                    </LinkButton>
                    <LinkButton tone="neutral" onClick={() => setEditingId(null)}>
                      Cancel
                    </LinkButton>
                  </td>
                </tr>
              ) : (
                <tr key={b.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-5 py-3.5 font-semibold text-gray-800">{b.name}</td>
                  <td className="px-5 py-3.5 text-gray-600">{b.semester}</td>
                  <td className="px-5 py-3.5 text-gray-600">{b.studentCount}</td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <LinkButton tone="primary" muted revealOnHover onClick={() => startEdit(b)} className="mr-3">
                      Edit
                    </LinkButton>
                    <LinkButton tone="danger" muted revealOnHover loading={deleteId === b.id} onClick={() => handleDelete(b.id)}>
                      {deleteId === b.id ? "Deleting…" : "Delete"}
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
