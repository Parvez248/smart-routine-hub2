"use client";

// Admin → Exams (Step 49). The exam-term list: create a term, open its
// builder, publish/unpublish it, delete it. Exams themselves live one level
// down, in [termId]/page.tsx — a term is just the folder holding one
// semester's Midterm and Final.
//
// Publishing is what will make a term visible to teachers and students
// (Step 51), so a term stays a draft until the admin says otherwise, and a
// published term can't be deleted until it's unpublished again (the 409
// comes from PATCH/DELETE /api/admin/exam-terms/[id]).
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { Table } from "@/app/components/ui/Table";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type ExamTerm = {
  id: number;
  name: string;
  isPublished: boolean;
  note: string | null;
  _count: { exams: number };
};

type TermForm = { name: string; note: string };
const emptyForm: TermForm = { name: "", note: "" };

export default function ExamTermsPage() {
  const [terms, setTerms] = useState<ExamTerm[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [form, setForm] = useState<TermForm>(emptyForm);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);

  async function loadTerms() {
    const res = await fetch("/api/admin/exam-terms");
    const json = await res.json();
    if (json.ok) setTerms(json.data);
    setLoadingState(false);
  }

  useEffect(() => { loadTerms(); }, []);

  function flash(type: "success" | "error", msg: string) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/exam-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, note: form.note || null }),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Exam term created.");
        setForm(emptyForm);
        await loadTerms();
      } else {
        flash("error", json.error ?? "Failed to create exam term.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTogglePublish(term: ExamTerm) {
    setActingId(term.id);
    try {
      const res = await fetch(`/api/admin/exam-terms/${term.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !term.isPublished }),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", term.isPublished ? "Exam term unpublished." : "Exam term published.");
        await loadTerms();
      } else {
        flash("error", json.error ?? "Failed to update exam term.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setActingId(null);
    }
  }

  async function handleDelete(term: ExamTerm) {
    // Deleting a term takes its exams with it (the FK cascades), so say how
    // many rather than asking a bare "are you sure?".
    const tail = term._count.exams > 0
      ? ` Its ${term._count.exams} ${term._count.exams === 1 ? "exam" : "exams"} will be deleted too.`
      : "";
    if (!confirm(`Delete "${term.name}"?${tail} This cannot be undone.`)) return;

    setActingId(term.id);
    try {
      const res = await fetch(`/api/admin/exam-terms/${term.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Exam term deleted.");
        await loadTerms();
      } else {
        flash("error", json.error ?? "Failed to delete exam term.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Exam Routine"
        description="Midterm and final exam schedules, one term at a time."
      />

      <Card>
        <CardHeader title="Add Exam Term" description="A term holds both its Midterm and Final exams." accent />
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="term-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Name <span className="text-cancelled">*</span>
              </label>
              <input
                id="term-name"
                type="text"
                required
                maxLength={60}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Fall 2026"
                className="border border-border bg-muted rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="term-note" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Note <span className="text-muted-foreground/60 normal-case font-normal">(optional)</span>
              </label>
              <input
                id="term-note"
                type="text"
                maxLength={500}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="e.g. Bring your student ID"
                className="border border-border bg-muted rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
              />
            </div>
          </div>

          {status && <Message type={status.type}>{status.msg}</Message>}

          <div className="flex justify-end">
            <Button type="submit" loading={submitting}>
              {submitting ? "Adding…" : "Add Exam Term"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title={<>Exam Terms <span className="ml-2 text-sm font-normal text-slate">{terms.length}</span></>} />

        {loading ? (
          <Loading />
        ) : terms.length === 0 ? (
          <EmptyState icon="📝" message="No exam terms yet. Add one above." />
        ) : (
          <Table headers={["Name", "Exams", "Status", ""]}>
            {terms.map((t) => (
              <tr key={t.id} className="hover:bg-muted/40 transition-colors group">
                <td className="px-5 py-3.5">
                  <Link href={`/admin/exams/${t.id}`} className="font-semibold text-foreground hover:text-primary transition-colors">
                    {t.name}
                  </Link>
                  {t.note && <p className="text-xs text-muted-foreground mt-0.5">{t.note}</p>}
                </td>
                <td className="px-5 py-3.5 text-muted-foreground font-data">{t._count.exams}</td>
                <td className="px-5 py-3.5">
                  {t.isPublished ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-confirmed/10 text-confirmed">
                      Published
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                      Draft
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <Link
                    href={`/admin/exams/${t.id}`}
                    className="text-xs font-semibold text-primary hover:opacity-80 transition-colors mr-3"
                  >
                    Open
                  </Link>
                  <LinkButton
                    tone={t.isPublished ? "warning" : "success"}
                    loading={actingId === t.id}
                    onClick={() => handleTogglePublish(t)}
                    className="mr-3"
                  >
                    {t.isPublished ? "Unpublish" : "Publish"}
                  </LinkButton>
                  <LinkButton tone="danger" muted loading={actingId === t.id} onClick={() => handleDelete(t)}>
                    Delete
                  </LinkButton>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
