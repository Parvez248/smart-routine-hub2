"use client";

// The exam builder for one term (Step 49) — Midterm and Final tabs over
// GET /api/admin/exam-terms/[termId]/exams, with add/edit through
// ExamDialog and delete through DELETE /api/admin/exams/[id].
//
// Exams are listed in sitting order (date, then start time) rather than
// grouped into a grid: an exam schedule is a short, sparse list of dated
// sittings, not the dense weekly table the class routine needs. Rendering
// the printable exam routine for students is Step 51's job.
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { Table } from "@/app/components/ui/Table";
import { Tabs } from "@/app/components/ui/Tabs";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";
import { sectionLabel } from "@/lib/ui/sections";
import { examDayName, formatTimeRange } from "@/lib/ui/examTime";
import { EXAM_TYPE_LABELS } from "@/lib/ui/examType";
import type { ExamTypeValue } from "@/lib/ui/examType";
import { ExamDialog } from "../_components/ExamDialog";
import type { ExamFormValues } from "../_components/ExamDialog";

type Term = { id: number; name: string; isPublished: boolean; note: string | null };

type Exam = {
  id: number;
  type: ExamTypeValue;
  section: string | null;
  date: string;
  startTime: string;
  endTime: string;
  course: { id: number; code: string; title: string };
  batch: { id: number; name: string; semester: string };
  rooms: { room: { id: number; name: string; capacity: number } }[];
};

type RefBatch = { id: number; name: string; semester: string };

const TABS = [
  { key: "midterm", label: "Midterm" },
  { key: "final", label: "Final" },
];

// The tab key in the URL ("midterm") vs the stored enum ("MIDTERM").
function typeForTab(tab: string): ExamTypeValue {
  return tab === "final" ? "FINAL" : "MIDTERM";
}

function newExamDefaults(type: ExamTypeValue): ExamFormValues {
  return { type, courseId: "", batchId: "", section: "", date: "", startTime: "", endTime: "", roomIds: [] };
}

function ExamBuilderInner() {
  const params = useParams<{ termId: string }>();
  const termId = Number(params.termId);
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "midterm";
  const type = typeForTab(tab);

  const [term, setTerm] = useState<Term | null>(null);
  const [exams, setExams] = useState<Exam[]>([]);
  const [batches, setBatches] = useState<RefBatch[]>([]);
  const [batchFilter, setBatchFilter] = useState("");
  const [loading, setLoadingState] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<ExamFormValues | null>(null);

  const loadExams = useCallback(async () => {
    if (!Number.isInteger(termId) || termId <= 0) {
      setLoadError("Invalid exam term.");
      setLoadingState(false);
      return;
    }
    const query = new URLSearchParams({ type });
    if (batchFilter) query.set("batchId", batchFilter);
    const res = await fetch(`/api/admin/exam-terms/${termId}/exams?${query.toString()}`);
    const json = await res.json();
    if (json.ok) {
      setTerm(json.data.term);
      setExams(json.data.exams);
      setLoadError(null);
    } else {
      setLoadError(json.error ?? "Failed to load exams.");
    }
    setLoadingState(false);
  }, [termId, type, batchFilter]);

  useEffect(() => { loadExams(); }, [loadExams]);

  // Only the batch list is needed here; the dialog loads the rest itself.
  useEffect(() => {
    fetch("/api/reference")
      .then((r) => r.json())
      .then((json) => { if (json.ok) setBatches(json.data.batches); });
  }, []);

  function flash(type: "success" | "error", msg: string) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 4000);
  }

  function openAdd() {
    setDialogInitial(newExamDefaults(type));
    setDialogOpen(true);
  }

  function openEdit(exam: Exam) {
    setDialogInitial({
      id: exam.id,
      type: exam.type,
      courseId: String(exam.course.id),
      batchId: String(exam.batch.id),
      section: exam.section ?? "",
      // The API sends the `@db.Date` column as an ISO timestamp at UTC
      // midnight, so the date part is taken verbatim — never via a local
      // Date, which would shift it a day west of UTC.
      date: exam.date.slice(0, 10),
      startTime: exam.startTime,
      endTime: exam.endTime,
      roomIds: exam.rooms.map((r) => r.room.id),
    });
    setDialogOpen(true);
  }

  async function handleDelete(exam: Exam) {
    if (!confirm(`Delete the ${exam.course.code} exam for ${exam.batch.name}? This cannot be undone.`)) return;
    setActingId(exam.id);
    try {
      const res = await fetch(`/api/admin/exams/${exam.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Exam deleted.");
        await loadExams();
      } else {
        flash("error", json.error ?? "Failed to delete exam.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setActingId(null);
    }
  }

  // Warnings don't block the save (see checkExamConflicts), so they ride
  // along with the success message instead of becoming an error.
  async function handleSaved(warnings: string[]) {
    const verb = dialogInitial?.id ? "Exam updated." : "Exam added.";
    flash("success", [verb, ...warnings].join(" "));
    await loadExams();
  }

  const batchOptions = useMemo(
    () => batches.map((b) => ({ value: String(b.id), label: `${b.name} — ${b.semester} sem` })),
    [batches]
  );

  if (loadError) {
    return (
      <>
        <PageHeader title="Exam Routine" />
        <Card>
          <EmptyState icon="⚠️" message={loadError} action={<Link href="/admin/exams" className="text-xs font-semibold text-primary">Back to exam terms</Link>} />
        </Card>
      </>
    );
  }

  return (
    <>
      <div>
        <Link href="/admin/exams" className="inline-flex items-center gap-1 text-xs font-semibold text-slate hover:text-foreground transition-colors mb-2">
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          All exam terms
        </Link>
        <PageHeader
          title={
            <>
              {term?.name ?? "Exam Routine"}
              {term && !term.isPublished && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                  Draft
                </span>
              )}
              {term?.isPublished && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-confirmed/10 text-confirmed">
                  Published
                </span>
              )}
            </>
          }
          description={term?.note ?? undefined}
          action={<Button onClick={openAdd}>Add Exam</Button>}
        />
      </div>

      <Tabs tabs={TABS} activeKey={tab} />

      {status && <Message type={status.type}>{status.msg}</Message>}

      <Card>
        <CardHeader
          title={
            <>
              {EXAM_TYPE_LABELS[type]} Exams <span className="ml-2 text-sm font-normal text-slate">{exams.length}</span>
            </>
          }
          action={
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              aria-label="Filter by batch"
              className="border border-border bg-muted rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All batches</option>
              {batchOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          }
        />

        {loading ? (
          <Loading />
        ) : exams.length === 0 ? (
          <EmptyState
            icon="🗓️"
            message={
              batchFilter
                ? `No ${EXAM_TYPE_LABELS[type].toLowerCase()} exams for this batch yet.`
                : `No ${EXAM_TYPE_LABELS[type].toLowerCase()} exams yet. Add one with the button above.`
            }
          />
        ) : (
          <Table headers={["Date", "Time", "Course", "Batch", "Rooms", ""]}>
            {exams.map((e) => {
              const date = e.date.slice(0, 10);
              const section = sectionLabel(e.section);
              return (
                <tr key={e.id} className="hover:bg-muted/40 transition-colors group">
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="font-semibold text-foreground font-data">{date}</span>
                    <span className="text-xs text-muted-foreground ml-2">{examDayName(new Date(e.date))}</span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground font-data whitespace-nowrap">
                    {formatTimeRange(e.startTime, e.endTime)}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-semibold text-foreground font-data">{e.course.code}</span>
                    <p className="text-xs text-muted-foreground">{e.course.title}</p>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="text-foreground">{e.batch.name}</span>
                    {section && <span className="text-xs text-muted-foreground ml-2">{section}</span>}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground font-data">
                    {e.rooms.map((r) => r.room.name).join(", ")}
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <LinkButton tone="primary" muted revealOnHover onClick={() => openEdit(e)} className="mr-3">
                      Edit
                    </LinkButton>
                    <LinkButton
                      tone="danger"
                      muted
                      revealOnHover
                      loading={actingId === e.id}
                      onClick={() => handleDelete(e)}
                    >
                      {actingId === e.id ? "Deleting…" : "Delete"}
                    </LinkButton>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <ExamDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        termId={termId}
        initial={dialogInitial}
        onSaved={handleSaved}
      />
    </>
  );
}

export default function ExamBuilderPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ExamBuilderInner />
    </Suspense>
  );
}
