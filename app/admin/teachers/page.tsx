"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { Table } from "@/app/components/ui/Table";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type Teacher = { id: number; initials: string; name: string };
type TeacherForm = { initials: string; name: string };

const emptyForm: TeacherForm = { initials: "", name: "" };

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [form, setForm] = useState<TeacherForm>(emptyForm);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<TeacherForm>(emptyForm);
  const [editSubmitting, setEditSubmitting] = useState(false);

  async function loadTeachers() {
    const res = await fetch("/api/admin/teachers");
    const json = await res.json();
    if (json.ok) setTeachers(json.data);
    setLoadingState(false);
  }

  useEffect(() => { loadTeachers(); }, []);

  function flash(type: "success" | "error", msg: string) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Teacher added.");
        setForm(emptyForm);
        await loadTeachers();
      } else {
        flash("error", json.error ?? "Failed to add teacher.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(teacher: Teacher) {
    setEditingId(teacher.id);
    setEditForm({ initials: teacher.initials, name: teacher.name });
  }

  async function handleEditSubmit(id: number) {
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/admin/teachers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Teacher updated.");
        setEditingId(null);
        await loadTeachers();
      } else {
        flash("error", json.error ?? "Failed to update teacher.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this teacher? This cannot be undone.")) return;
    setDeleteId(id);
    try {
      const res = await fetch(`/api/admin/teachers/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Teacher deleted.");
        await loadTeachers();
      } else {
        flash("error", json.error ?? "Failed to delete teacher.");
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
        title="Teachers"
        description="Manage the teacher roster used when building the routine."
        action={
          <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-3 py-1 rounded-full">
            {teachers.length} teachers
          </span>
        }
      />

      <Card>
        <CardHeader title="Add Teacher" accent />
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Initials <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.initials}
                onChange={(e) => setForm((f) => ({ ...f, initials: e.target.value }))}
                placeholder="e.g. MKP"
                className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Md. Khaled Parvez"
                className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>
          </div>

          {status && <Message type={status.type}>{status.msg}</Message>}

          <div className="flex justify-end">
            <Button type="submit" loading={submitting}>
              {submitting ? "Adding…" : "Add Teacher"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title={<>Teachers <span className="ml-2 text-sm font-normal text-gray-400">{teachers.length}</span></>} />

        {loading ? (
          <Loading />
        ) : teachers.length === 0 ? (
          <EmptyState icon="🧑‍🏫" message="No teachers yet. Add one above." />
        ) : (
          <Table headers={["Initials", "Name", ""]}>
            {teachers.map((t) =>
              editingId === t.id ? (
                <tr key={t.id} className="bg-indigo-50/40">
                  <td className="px-5 py-3">
                    <input
                      value={editForm.initials}
                      onChange={(e) => setEditForm((f) => ({ ...f, initials: e.target.value }))}
                      className="w-full border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-5 py-3">
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full border border-gray-200 bg-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <LinkButton tone="primary" loading={editSubmitting} onClick={() => handleEditSubmit(t.id)} className="mr-3">
                      Save
                    </LinkButton>
                    <LinkButton tone="neutral" onClick={() => setEditingId(null)}>
                      Cancel
                    </LinkButton>
                  </td>
                </tr>
              ) : (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-5 py-3.5 font-semibold text-gray-800">{t.initials}</td>
                  <td className="px-5 py-3.5 text-gray-600">{t.name}</td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <LinkButton tone="primary" muted revealOnHover onClick={() => startEdit(t)} className="mr-3">
                      Edit
                    </LinkButton>
                    <LinkButton tone="danger" muted revealOnHover loading={deleteId === t.id} onClick={() => handleDelete(t.id)}>
                      {deleteId === t.id ? "Deleting…" : "Delete"}
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
