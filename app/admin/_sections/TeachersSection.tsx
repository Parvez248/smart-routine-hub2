"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { Table } from "@/app/components/ui/Table";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type Teacher = { id: number; initials: string; name: string; userId: number | null; email: string | null };
type TeacherForm = { initials: string; name: string };
type Credential = { initials: string; name: string; email: string; password: string };

const emptyForm: TeacherForm = { initials: "", name: "" };

export default function TeachersSection() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [form, setForm] = useState<TeacherForm>(emptyForm);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<TeacherForm>(emptyForm);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [loginBusyId, setLoginBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [reveal, setReveal] = useState<Credential[] | null>(null);
  const [copied, setCopied] = useState(false);

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

  async function handleCreateLogin(teacher: Teacher) {
    setLoginBusyId(teacher.id);
    try {
      const res = await fetch(`/api/admin/teachers/${teacher.id}/create-login`, { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        setReveal([json.data]);
        setCopied(false);
        await loadTeachers();
      } else {
        flash("error", json.error ?? "Failed to create login.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setLoginBusyId(null);
    }
  }

  async function handleResetPassword(teacher: Teacher) {
    if (!confirm(`Reset the password for ${teacher.name}? Their current password will stop working.`)) return;
    setLoginBusyId(teacher.id);
    try {
      const res = await fetch(`/api/admin/teachers/${teacher.id}/reset-password`, { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        setReveal([json.data]);
        setCopied(false);
      } else {
        flash("error", json.error ?? "Failed to reset password.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setLoginBusyId(null);
    }
  }

  async function handleCreateAllLogins() {
    setBulkBusy(true);
    try {
      const res = await fetch("/api/admin/teachers/create-logins", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        if (json.data.created.length > 0) {
          setReveal(json.data.created);
          setCopied(false);
        } else {
          flash("success", "All teachers already have logins.");
        }
        await loadTeachers();
      } else {
        flash("error", json.error ?? "Failed to create logins.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setBulkBusy(false);
    }
  }

  function copyCredentials() {
    if (!reveal) return;
    const text = reveal.map((c) => `${c.name} (${c.initials})\t${c.email}\t${c.password}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const teachersWithoutLogin = teachers.filter((t) => !t.userId).length;

  return (
    <>
      {reveal && (
        <Card>
          <CardHeader
            title={`${reveal.length > 1 ? "New Logins Created" : "Login Credentials"}`}
            description="Copy or print this now — passwords cannot be shown again after you leave this page."
            accent
          />
          <div className="p-6 space-y-4">
            <div className="overflow-x-auto rounded-lg border border-moved/30">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-moved/10 text-moved text-xs uppercase tracking-wide">
                    <th className="px-4 py-2 text-left font-semibold">Teacher</th>
                    <th className="px-4 py-2 text-left font-semibold">Email</th>
                    <th className="px-4 py-2 text-left font-semibold">Password</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-moved/20">
                  {reveal.map((c) => (
                    <tr key={c.email}>
                      <td className="px-4 py-2.5">{c.name} ({c.initials})</td>
                      <td className="px-4 py-2.5 font-data">{c.email}</td>
                      <td className="px-4 py-2.5 font-data font-semibold">{c.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs font-semibold text-moved">
              ⚠️ Save or hand out these credentials now. This list disappears once you refresh or leave this page and cannot be recovered — use &quot;Reset password&quot; if a teacher loses theirs.
            </p>

            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" onClick={copyCredentials}>
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => window.print()}>
                Print
              </Button>
              <LinkButton tone="neutral" onClick={() => setReveal(null)}>
                Dismiss
              </LinkButton>
            </div>
          </div>
        </Card>
      )}

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
        <CardHeader
          title={<>Teachers <span className="ml-2 text-sm font-normal text-slate">{teachers.length}</span></>}
          action={
            teachersWithoutLogin > 0 ? (
              <Button type="button" variant="secondary" loading={bulkBusy} onClick={handleCreateAllLogins}>
                {bulkBusy ? "Creating…" : `Create logins for all (${teachersWithoutLogin})`}
              </Button>
            ) : undefined
          }
        />

        {loading ? (
          <Loading />
        ) : teachers.length === 0 ? (
          <EmptyState icon="🧑‍🏫" message="No teachers yet. Add one above." />
        ) : (
          <Table headers={["Initials", "Name", "Login", ""]}>
            {teachers.map((t) =>
              editingId === t.id ? (
                <tr key={t.id} className="bg-primary/5">
                  <td className="px-5 py-3">
                    <input
                      value={editForm.initials}
                      onChange={(e) => setEditForm((f) => ({ ...f, initials: e.target.value }))}
                      className="w-full border border-border bg-card rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </td>
                  <td className="px-5 py-3">
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full border border-border bg-card rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </td>
                  <td className="px-5 py-3 text-muted-foreground text-xs">{t.email ?? "—"}</td>
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
                <tr key={t.id} className="hover:bg-muted/40 transition-colors group">
                  <td className="px-5 py-3.5 font-semibold font-data text-foreground">{t.initials}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{t.name}</td>
                  <td className="px-5 py-3.5 text-muted-foreground font-data text-xs">
                    {t.email ?? <span className="text-muted-foreground/60 font-sans italic">No login</span>}
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    {t.userId ? (
                      <LinkButton
                        tone="warning"
                        muted
                        revealOnHover
                        loading={loginBusyId === t.id}
                        onClick={() => handleResetPassword(t)}
                        className="mr-3"
                      >
                        Reset password
                      </LinkButton>
                    ) : (
                      <LinkButton
                        tone="success"
                        muted
                        revealOnHover
                        loading={loginBusyId === t.id}
                        onClick={() => handleCreateLogin(t)}
                        className="mr-3"
                      >
                        Create login
                      </LinkButton>
                    )}
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
