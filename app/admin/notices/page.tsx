"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type Notice = { id: number; title: string; body: string; audience: string; createdAt: string };
type NoticeForm = { title: string; body: string; audience: "ALL" | "TEACHERS" | "STUDENTS" };

const emptyForm: NoticeForm = { title: "", body: "", audience: "ALL" };

function AudienceBadge({ audience }: { audience: string }) {
  const styles: Record<string, string> = {
    ALL: "bg-indigo-100 text-indigo-700",
    TEACHERS: "bg-violet-100 text-violet-700",
    STUDENTS: "bg-sky-100 text-sky-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[audience] ?? "bg-gray-100 text-gray-600"}`}>
      {audience === "ALL" ? "Everyone" : audience.charAt(0) + audience.slice(1).toLowerCase()}
    </span>
  );
}

export default function NoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [form, setForm] = useState<NoticeForm>(emptyForm);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<NoticeForm>(emptyForm);
  const [editSubmitting, setEditSubmitting] = useState(false);

  async function loadNotices() {
    const res = await fetch("/api/admin/notices");
    const json = await res.json();
    if (json.ok) setNotices(json.data);
    setLoadingState(false);
  }

  useEffect(() => { loadNotices(); }, []);

  function flash(type: "success" | "error", msg: string) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Notice posted.");
        setForm(emptyForm);
        await loadNotices();
      } else {
        flash("error", json.error ?? "Failed to post notice.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(notice: Notice) {
    setEditingId(notice.id);
    setEditForm({
      title: notice.title,
      body: notice.body,
      audience: notice.audience as "ALL" | "TEACHERS" | "STUDENTS",
    });
  }

  async function handleEditSubmit(id: number) {
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/admin/notices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Notice updated.");
        setEditingId(null);
        await loadNotices();
      } else {
        flash("error", json.error ?? "Failed to update notice.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this notice? This cannot be undone.")) return;
    setDeleteId(id);
    try {
      const res = await fetch(`/api/admin/notices/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Notice deleted.");
        await loadNotices();
      } else {
        flash("error", json.error ?? "Failed to delete notice.");
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
        title="Notices"
        description="Post announcements for teachers and students."
        action={
          <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-3 py-1 rounded-full">
            {notices.length} notices
          </span>
        }
      />

      <Card>
        <CardHeader title="Post Notice" accent />
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Class rescheduled"
                className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Audience <span className="text-red-400">*</span>
              </label>
              <select
                required
                value={form.audience}
                onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value as NoticeForm["audience"] }))}
                className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              >
                <option value="ALL">Everyone</option>
                <option value="TEACHERS">Teachers</option>
                <option value="STUDENTS">Students</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Body <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Notice details…"
              className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-y"
            />
          </div>

          {status && <Message type={status.type}>{status.msg}</Message>}

          <div className="flex justify-end">
            <Button type="submit" loading={submitting}>
              {submitting ? "Posting…" : "Post Notice"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title={<>Notices <span className="ml-2 text-sm font-normal text-gray-400">{notices.length}</span></>} />

        {loading ? (
          <Loading />
        ) : notices.length === 0 ? (
          <EmptyState icon="📣" message="No notices yet. Post one above." />
        ) : (
          <div className="divide-y divide-gray-50">
            {notices.map((n) =>
              editingId === n.id ? (
                <div key={n.id} className="p-6 bg-indigo-50/40 space-y-3">
                  <input
                    value={editForm.title}
                    onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <select
                    value={editForm.audience}
                    onChange={(e) => setEditForm((f) => ({ ...f, audience: e.target.value as NoticeForm["audience"] }))}
                    className="border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ALL">Everyone</option>
                    <option value="TEACHERS">Teachers</option>
                    <option value="STUDENTS">Students</option>
                  </select>
                  <textarea
                    rows={3}
                    value={editForm.body}
                    onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))}
                    className="w-full border border-gray-200 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                  />
                  <div>
                    <LinkButton tone="primary" loading={editSubmitting} onClick={() => handleEditSubmit(n.id)} className="mr-3">
                      Save
                    </LinkButton>
                    <LinkButton tone="neutral" onClick={() => setEditingId(null)}>
                      Cancel
                    </LinkButton>
                  </div>
                </div>
              ) : (
                <div key={n.id} className="p-6 group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-800">{n.title}</h3>
                        <AudienceBadge audience={n.audience} />
                      </div>
                      <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-wrap">{n.body}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      <LinkButton tone="primary" muted onClick={() => startEdit(n)} className="mr-3">
                        Edit
                      </LinkButton>
                      <LinkButton tone="danger" muted loading={deleteId === n.id} onClick={() => handleDelete(n.id)}>
                        {deleteId === n.id ? "Deleting…" : "Delete"}
                      </LinkButton>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </Card>
    </>
  );
}
