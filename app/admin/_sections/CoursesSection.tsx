"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { Table } from "@/app/components/ui/Table";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type Course = { id: number; code: string; title: string; type: string };
type CourseForm = { code: string; title: string; type: "THEORY" | "LAB" };

const emptyForm: CourseForm = { code: "", title: "", type: "THEORY" };

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
      type === "LAB" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
    }`}>
      {type === "LAB" ? "Lab" : "Theory"}
    </span>
  );
}

export default function CoursesSection() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [form, setForm] = useState<CourseForm>(emptyForm);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CourseForm>(emptyForm);
  const [editSubmitting, setEditSubmitting] = useState(false);

  async function loadCourses() {
    const res = await fetch("/api/admin/courses");
    const json = await res.json();
    if (json.ok) setCourses(json.data);
    setLoadingState(false);
  }

  useEffect(() => { loadCourses(); }, []);

  function flash(type: "success" | "error", msg: string) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Course added.");
        setForm(emptyForm);
        await loadCourses();
      } else {
        flash("error", json.error ?? "Failed to add course.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(course: Course) {
    setEditingId(course.id);
    setEditForm({ code: course.code, title: course.title, type: course.type as "THEORY" | "LAB" });
  }

  async function handleEditSubmit(id: number) {
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/admin/courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Course updated.");
        setEditingId(null);
        await loadCourses();
      } else {
        flash("error", json.error ?? "Failed to update course.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this course? This cannot be undone.")) return;
    setDeleteId(id);
    try {
      const res = await fetch(`/api/admin/courses/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Course deleted.");
        await loadCourses();
      } else {
        flash("error", json.error ?? "Failed to delete course.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader title="Add Course" accent />
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="course-code" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Code <span className="text-cancelled">*</span>
              </label>
              <input
                id="course-code"
                type="text"
                required
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="e.g. CSE101"
                className="border border-border bg-muted rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="course-title" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Title <span className="text-cancelled">*</span>
              </label>
              <input
                id="course-title"
                type="text"
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Structured Programming"
                className="border border-border bg-muted rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="course-type" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Type <span className="text-cancelled">*</span>
              </label>
              <select
                id="course-type"
                required
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "THEORY" | "LAB" }))}
                className="w-full border border-border bg-muted rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
              >
                <option value="THEORY">Theory</option>
                <option value="LAB">Lab</option>
              </select>
            </div>
          </div>

          {status && <Message type={status.type}>{status.msg}</Message>}

          <div className="flex justify-end">
            <Button type="submit" loading={submitting}>
              {submitting ? "Adding…" : "Add Course"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title={<>Courses <span className="ml-2 text-sm font-normal text-slate">{courses.length}</span></>} />

        {loading ? (
          <Loading />
        ) : courses.length === 0 ? (
          <EmptyState icon="📚" message="No courses yet. Add one above." />
        ) : (
          <Table headers={["Code", "Title", "Type", ""]}>
            {courses.map((c) =>
              editingId === c.id ? (
                <tr key={c.id} className="bg-primary/5">
                  <td className="px-5 py-3">
                    <input
                      value={editForm.code}
                      onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value }))}
                      className="w-full border border-border bg-card rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </td>
                  <td className="px-5 py-3">
                    <input
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      className="w-full border border-border bg-card rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={editForm.type}
                      onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value as "THEORY" | "LAB" }))}
                      className="w-full border border-border bg-card rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="THEORY">Theory</option>
                      <option value="LAB">Lab</option>
                    </select>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <LinkButton tone="primary" loading={editSubmitting} onClick={() => handleEditSubmit(c.id)} className="mr-3">
                      Save
                    </LinkButton>
                    <LinkButton tone="neutral" onClick={() => setEditingId(null)}>
                      Cancel
                    </LinkButton>
                  </td>
                </tr>
              ) : (
                <tr key={c.id} className="hover:bg-muted/40 transition-colors group">
                  <td className="px-5 py-3.5 font-semibold font-data text-foreground">{c.code}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{c.title}</td>
                  <td className="px-5 py-3.5"><TypeBadge type={c.type} /></td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <LinkButton tone="primary" muted revealOnHover onClick={() => startEdit(c)} className="mr-3">
                      Edit
                    </LinkButton>
                    <LinkButton tone="danger" muted revealOnHover loading={deleteId === c.id} onClick={() => handleDelete(c.id)}>
                      {deleteId === c.id ? "Deleting…" : "Delete"}
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
