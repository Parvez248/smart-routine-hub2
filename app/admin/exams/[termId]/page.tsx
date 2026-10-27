"use client";

// The exam builder for one term — Midterm and Final tabs over
// GET /api/admin/exam-terms/[termId]/exams, with add/edit through
// ExamDialog and delete through DELETE /api/admin/exams/[id].
//
// Exams are listed in sitting order (date, then sitting, then start time)
// rather than grouped into a grid: an exam schedule is a short, sparse list
// of dated sittings, not the dense weekly table the class routine needs.
// Filtering by date + sitting turns the list into the view the admin
// actually works from — everything placed in one sitting, with a strip
// showing how full each room is. Rendering the printable exam routine for
// students is Step 51's job.
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
import { examDayName, formatTimeRange, defaultTimesFor } from "@/lib/ui/examTime";
import { EXAM_TYPE_LABELS, EXAM_SITTINGS, EXAM_SITTING_LABELS } from "@/lib/ui/examType";
import type { ExamSittingValue, ExamTypeValue } from "@/lib/ui/examType";
import { roomLabel } from "@/lib/ui/rooms";
import { ExamDialog } from "../_components/ExamDialog";
import type { ExamFormValues } from "../_components/ExamDialog";

type Term = {
  id: number;
  name: string;
  isPublished: boolean;
  note: string | null;
  morningStart: string;
  afternoonStart: string;
};

type Exam = {
  id: number;
  type: ExamTypeValue;
  sitting: ExamSittingValue;
  section: string | null;
  date: string;
  startTime: string;
  endTime: string;
  course: { id: number; code: string; title: string };
  batch: { id: number; name: string; semester: string };
  rooms: { seats: number | null; room: { id: number; name: string; capacity: number } }[];
};

type RefBatch = { id: number; name: string; semester: string };

type RoomAvailability = {
  id: number;
  name: string;
  capacity: number;
  seatsUsed: number;
  seatsLeft: number;
  hasUnknownSeats: boolean;
};

const TABS = [
  { key: "midterm", label: "Midterm" },
  { key: "final", label: "Final" },
];

// The tab key in the URL ("midterm") vs the stored enum ("MIDTERM").
function typeForTab(tab: string): ExamTypeValue {
  return tab === "final" ? "FINAL" : "MIDTERM";
}

function newExamDefaults(term: Term, type: ExamTypeValue, sitting: ExamSittingValue): ExamFormValues {
  // No course is chosen yet, so the end time uses the theory duration for
  // this exam kind; picking a lab course moves it in the dialog.
  const times = defaultTimesFor(term, sitting, type, undefined);
  return {
    type,
    sitting,
    courseId: "",
    batchId: "",
    section: "",
    date: "",
    rooms: [],
    ...times,
  };
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
  const [dateFilter, setDateFilter] = useState("");
  const [sittingFilter, setSittingFilter] = useState<"" | ExamSittingValue>("");
  const [loading, setLoadingState] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogInitial, setDialogInitial] = useState<ExamFormValues | null>(null);

  const [settings, setSettings] = useState<{ morningStart: string; afternoonStart: string } | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const [sittingRooms, setSittingRooms] = useState<RoomAvailability[] | null>(null);

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
      setSettings((s) => s ?? {
        morningStart: json.data.term.morningStart,
        afternoonStart: json.data.term.afternoonStart,
      });
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

  // With a date and a sitting chosen, show how full every room is in it.
  // This comes from the availability endpoint, not from the rows below, so
  // it counts exams in other terms and of the other kind as well.
  useEffect(() => {
    if (!dateFilter || !sittingFilter) { setSittingRooms(null); return; }
    const params = new URLSearchParams({ date: dateFilter, sitting: sittingFilter });
    fetch(`/api/admin/exams/room-availability?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => setSittingRooms(json.ok ? json.data : null))
      .catch(() => setSittingRooms(null));
  }, [dateFilter, sittingFilter, exams]);

  function flash(type: "success" | "error", msg: string) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 4000);
  }

  function openAdd() {
    if (!term) return;
    setDialogInitial(newExamDefaults(term, type, sittingFilter || "MORNING"));
    setDialogOpen(true);
  }

  function openEdit(exam: Exam) {
    setDialogInitial({
      id: exam.id,
      type: exam.type,
      sitting: exam.sitting,
      courseId: String(exam.course.id),
      batchId: String(exam.batch.id),
      section: exam.section ?? "",
      // The API sends the `@db.Date` column as an ISO timestamp at UTC
      // midnight, so the date part is taken verbatim — never via a local
      // Date, which would shift it a day west of UTC.
      date: exam.date.slice(0, 10),
      startTime: exam.startTime,
      endTime: exam.endTime,
      rooms: exam.rooms.map((r) => ({ roomId: r.room.id, seats: r.seats === null ? "" : String(r.seats) })),
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

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/admin/exam-terms/${termId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Sitting times saved.");
        await loadExams();
      } else {
        flash("error", json.error ?? "Failed to save sitting times.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setSavingSettings(false);
    }
  }

  const batchOptions = useMemo(
    () => batches.map((b) => ({ value: String(b.id), label: `${b.name} — ${b.semester} sem` })),
    [batches]
  );

  // Date and sitting narrow the list in the browser: the rows for one term
  // and kind are few, and it keeps the filters instant.
  const visibleExams = useMemo(
    () =>
      exams.filter(
        (e) =>
          (!dateFilter || e.date.slice(0, 10) === dateFilter) &&
          (!sittingFilter || e.sitting === sittingFilter)
      ),
    [exams, dateFilter, sittingFilter]
  );

  const roomsInUse = (sittingRooms ?? []).filter((r) => r.seatsUsed > 0 || r.hasUnknownSeats);

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
          action={<Button onClick={openAdd} disabled={!term}>Add Exam</Button>}
        />
      </div>

      <Tabs tabs={TABS} activeKey={tab} />

      {status && <Message type={status.type}>{status.msg}</Message>}

      {/* The two sitting start times for this term — what a new exam's start
          time is filled from, so a term running early mornings is typed once. */}
      {settings && (
        <Card>
          <CardHeader title="Sitting Times" description="Used to fill the start time of a new exam in this term." />
          <form onSubmit={saveSettings} className="p-6 flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="morning-start" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Morning starts at
              </label>
              <input
                id="morning-start"
                type="time"
                required
                value={settings.morningStart}
                onChange={(e) => setSettings((s) => (s ? { ...s, morningStart: e.target.value } : s))}
                className="border border-border bg-muted rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="afternoon-start" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Afternoon starts at
              </label>
              <input
                id="afternoon-start"
                type="time"
                required
                value={settings.afternoonStart}
                onChange={(e) => setSettings((s) => (s ? { ...s, afternoonStart: e.target.value } : s))}
                className="border border-border bg-muted rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button type="submit" loading={savingSettings}>
              {savingSettings ? "Saving…" : "Save"}
            </Button>
          </form>
        </Card>
      )}

      <Card>
        <CardHeader
          title={
            <>
              {EXAM_TYPE_LABELS[type]} Exams <span className="ml-2 text-sm font-normal text-slate">{visibleExams.length}</span>
            </>
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                aria-label="Filter by date"
                className="border border-border bg-muted rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <select
                value={sittingFilter}
                onChange={(e) => setSittingFilter(e.target.value as "" | ExamSittingValue)}
                aria-label="Filter by sitting"
                className="border border-border bg-muted rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Both sittings</option>
                {EXAM_SITTINGS.map((s) => (
                  <option key={s} value={s}>{EXAM_SITTING_LABELS[s]}</option>
                ))}
              </select>
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
            </div>
          }
        />

        {/* With one sitting in view, how full each room is across every term. */}
        {dateFilter && sittingFilter && roomsInUse.length > 0 && (
          <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-x-4 gap-y-1.5 bg-muted/40">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {EXAM_SITTING_LABELS[sittingFilter]} seats
            </span>
            {roomsInUse.map((r) => (
              <span key={r.id} className={`text-xs font-data ${r.seatsLeft === 0 ? "text-cancelled font-semibold" : "text-slate"}`}>
                {roomLabel(r.name)} {r.seatsUsed} / {r.capacity}
                {r.hasUnknownSeats && <span className="text-pending"> (some unknown)</span>}
              </span>
            ))}
          </div>
        )}

        {loading ? (
          <Loading />
        ) : visibleExams.length === 0 ? (
          <EmptyState
            icon="🗓️"
            message={
              batchFilter || dateFilter || sittingFilter
                ? `No ${EXAM_TYPE_LABELS[type].toLowerCase()} exams match these filters.`
                : `No ${EXAM_TYPE_LABELS[type].toLowerCase()} exams yet. Add one with the button above.`
            }
          />
        ) : (
          <Table headers={["Date", "Sitting", "Time", "Course", "Batch", "Rooms", ""]}>
            {visibleExams.map((e) => {
              const date = e.date.slice(0, 10);
              const section = sectionLabel(e.section);
              return (
                <tr key={e.id} className="hover:bg-muted/40 transition-colors group">
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="font-semibold text-foreground font-data">{date}</span>
                    <span className="text-xs text-muted-foreground ml-2">{examDayName(new Date(e.date))}</span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                      {EXAM_SITTING_LABELS[e.sitting]}
                    </span>
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
                    {e.rooms
                      .map((r) => `${roomLabel(r.room.name)}${r.seats === null ? "" : ` (${r.seats})`}`)
                      .join(", ")}
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

      {term && (
        <ExamDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          term={term}
          initial={dialogInitial}
          onSaved={handleSaved}
        />
      )}
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
