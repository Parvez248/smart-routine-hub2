"use client";

// The exam routine as teachers and students read it (Step 51) — a desktop
// table on wide screens and a list of cards on phones, with Midterm and
// Final tabs and a count summary.
//
// Deliberately a flat, dated list rather than the class routine's weekly
// grid: an exam schedule is a handful of dated sittings spread over a
// fortnight, which a grid would render almost entirely empty.
//
// Badges and pills are reused from the class routine's RowBadges so a batch
// and a LAB course look the same everywhere in the app.
import { useMemo, useState } from "react";
import { BatchPill, TypePill, courseTitleIfDifferent } from "@/app/components/routine/RowBadges";
import { Table } from "@/app/components/ui/Table";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { sectionLabel } from "@/lib/ui/sections";
import { roomLabel } from "@/lib/ui/rooms";
import {
  formatExamDate,
  formatTime12,
  isLab,
  isPastExam,
  nextExamOf,
  weekdayOf,
} from "@/lib/ui/examFormat";
import type { ViewExam } from "@/lib/ui/examFormat";
import type { ExamTypeValue } from "@/lib/ui/examType";
import { EXAM_TYPE_LABELS } from "@/lib/ui/examType";

function Done() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">
      Done
    </span>
  );
}

function Next() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
      Next
    </span>
  );
}

function roomsOf(exam: ViewExam): string {
  if (exam.rooms.length === 0) return "—";
  return exam.rooms.map((r) => roomLabel(r.name)).join(", ");
}

export function ExamRoutineTable({
  exams,
  today,
  showFilters = false,
  emptyMessage = "No exams in this term yet.",
}: {
  exams: ViewExam[];
  today: string;
  showFilters?: boolean;
  emptyMessage?: string;
}) {
  const [tab, setTab] = useState<ExamTypeValue>("MIDTERM");
  const [batchFilter, setBatchFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  // The "Next" badge is judged across the whole term, not just the open
  // tab, so it doesn't jump to a different exam when the tab changes.
  const next = useMemo(() => nextExamOf(exams, today), [exams, today]);

  const counts = useMemo(
    () => ({
      midterm: exams.filter((e) => e.type === "MIDTERM").length,
      final: exams.filter((e) => e.type === "FINAL").length,
      lab: exams.filter(isLab).length,
    }),
    [exams]
  );

  const batches = useMemo(() => {
    const seen = new Map<number, { id: number; name: string; semester: string }>();
    for (const e of exams) seen.set(e.batch.id, e.batch);
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [exams]);

  const visible = useMemo(
    () =>
      exams.filter(
        (e) =>
          e.type === tab &&
          (!batchFilter || String(e.batch.id) === batchFilter) &&
          (!dateFilter || e.date === dateFilter)
      ),
    [exams, tab, batchFilter, dateFilter]
  );

  const filterClass =
    "border border-border bg-muted rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-border">
        <nav className="flex items-center gap-1" aria-label="Exam type">
          {(["MIDTERM", "FINAL"] as ExamTypeValue[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              aria-current={tab === value ? "page" : undefined}
              className={`px-3 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                tab === value ? "bg-primary text-primary-foreground" : "text-slate hover:text-foreground"
              }`}
            >
              {EXAM_TYPE_LABELS[value]}
              <span className="ml-1.5 text-xs font-normal opacity-80">
                {value === "MIDTERM" ? counts.midterm : counts.final}
              </span>
            </button>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate font-data">
            Midterm {counts.midterm} · Final {counts.final} · Lab {counts.lab}
          </span>
          {showFilters && batches.length > 1 && (
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              aria-label="Filter by batch"
              className={filterClass}
            >
              <option value="">All batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name} — {b.semester} sem</option>
              ))}
            </select>
          )}
          {showFilters && (
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter by date"
              className={filterClass}
            />
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="🗓️" message={emptyMessage} />
      ) : (
        <>
          {/* Desktop */}
          <div className="hidden sm:block">
            <Table headers={["Date", "Course", "Batch", "Sec", "Time", "Room(s)"]}>
              {visible.map((exam) => {
                const past = isPastExam(exam, today);
                const title = courseTitleIfDifferent(exam.course);
                return (
                  <tr key={exam.id} className={`transition-colors ${past ? "opacity-55" : "hover:bg-muted/40"}`}>
                    <td className="px-5 py-3.5 whitespace-nowrap align-top">
                      <span className="font-semibold text-foreground font-data">{formatExamDate(exam.date)}</span>
                      <p className="text-xs text-muted-foreground">{weekdayOf(exam.date)}</p>
                    </td>
                    <td className="px-5 py-3.5 align-top">
                      <span className="inline-flex items-center gap-2">
                        <span className="font-semibold text-foreground font-data">{exam.course.code}</span>
                        {isLab(exam) && <TypePill type="LAB" batch={exam.batch} />}
                        {past && <Done />}
                        {!past && next?.id === exam.id && <Next />}
                      </span>
                      {title && <p className="text-xs text-muted-foreground mt-0.5">{title}</p>}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap align-top">
                      <BatchPill batch={exam.batch} />
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap align-top text-muted-foreground text-xs">
                      {sectionLabel(exam.section) ?? "—"}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap align-top font-data text-sm">
                      <span className="text-foreground">{formatTime12(exam.startTime)}</span>
                      <p className="text-xs text-muted-foreground">{formatTime12(exam.endTime)}</p>
                    </td>
                    <td className="px-5 py-3.5 align-top text-muted-foreground font-data text-sm">
                      {roomsOf(exam)}
                    </td>
                  </tr>
                );
              })}
            </Table>
          </div>

          {/* Phones — a date block on the left, the exam's details on the right. */}
          <ul className="sm:hidden divide-y divide-border">
            {visible.map((exam) => {
              const past = isPastExam(exam, today);
              const title = courseTitleIfDifferent(exam.course);
              const [, month, day] = exam.date.split("-");
              return (
                <li key={exam.id} className={`flex gap-3 px-4 py-3 ${past ? "opacity-55" : ""}`}>
                  <div className="shrink-0 w-14 text-center rounded-lg bg-muted py-1.5">
                    <p className="text-lg font-semibold text-foreground font-data leading-none">{day}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                      {formatExamDate(exam.date).split(" ")[1] ?? month}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{weekdayOf(exam.date).slice(0, 3)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground font-data">{exam.course.code}</span>
                      {isLab(exam) && <TypePill type="LAB" batch={exam.batch} />}
                      {past && <Done />}
                      {!past && next?.id === exam.id && <Next />}
                    </div>
                    {title && <p className="text-xs text-muted-foreground mt-0.5 truncate">{title}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <BatchPill batch={exam.batch} section={exam.section} />
                      <span className="text-xs text-muted-foreground font-data">
                        {formatTime12(exam.startTime)} – {formatTime12(exam.endTime)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-data mt-1">{roomsOf(exam)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
