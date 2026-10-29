"use client";

// The whole read-only exam page (Step 51), shared by the teacher and
// student areas. The two differ only in which endpoint they read, what
// their two scopes are called, and whether the sitting sheet is offered —
// everything else (term picker, tabs, next-exam card, table, printing) is
// identical, so it lives here once.
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";
import { nextExamOf, todayInDhaka } from "@/lib/ui/examFormat";
import type { ViewExam } from "@/lib/ui/examFormat";
import { ExamRoutineTable } from "./ExamRoutineTable";
import { NextExamCard } from "./NextExamCard";
import { ExamPrintControls } from "./ExamPrintControls";

type PublishedTerm = {
  id: number;
  name: string;
  note: string | null;
  counts: { midterm: number; final: number; lab: number };
};

type Scope = "mine" | "all";

export function ExamRoutineView({
  endpoint,
  scopeLabels,
  description,
  allowSittingSheet = false,
  emptyMineMessage,
}: {
  endpoint: string;
  scopeLabels: { mine: string; all: string };
  description: string;
  allowSittingSheet?: boolean;
  emptyMineMessage: string;
}) {
  const [terms, setTerms] = useState<PublishedTerm[] | null>(null);
  const [termId, setTermId] = useState<number | null>(null);
  const [scope, setScope] = useState<Scope>("mine");
  const [exams, setExams] = useState<ViewExam[]>([]);
  const [term, setTerm] = useState<PublishedTerm | null>(null);
  const [ownBatchId, setOwnBatchId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // "Today" is Asia/Dhaka's date, not the viewer's — fixed for the life of
  // the page, which is correct for a page nobody leaves open past midnight.
  const today = useMemo(() => todayInDhaka(), []);

  // The published terms, newest first; the newest is selected by default.
  useEffect(() => {
    fetch("/api/exams/terms")
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) { setError(json.error ?? "Failed to load exam terms."); setLoading(false); return; }
        setTerms(json.data);
        if (json.data.length > 0) setTermId(json.data[0].id);
        else setLoading(false);
      })
      .catch(() => { setError("Network error. Please try again."); setLoading(false); });
  }, []);

  const loadExams = useCallback(async () => {
    if (termId === null) return;
    setLoading(true);
    try {
      const res = await fetch(`${endpoint}?termId=${termId}&scope=${scope}`);
      const json = await res.json();
      if (json.ok) {
        setExams(json.data.exams);
        setTerm(json.data.term);
        if (typeof json.data.batchId === "number") setOwnBatchId(json.data.batchId);
        setError(null);
      } else {
        // A term that stops being published while the page is open comes
        // back as a 404; say so plainly rather than showing a stale list.
        setExams([]);
        setError(res.status === 404 ? "This exam routine is no longer published." : json.error ?? "Failed to load exams.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [endpoint, termId, scope]);

  useEffect(() => { loadExams(); }, [loadExams]);

  const next = useMemo(() => nextExamOf(exams, today), [exams, today]);

  if (terms !== null && terms.length === 0) {
    return (
      <>
        <PageHeader title="Exam Routine" description={description} />
        <Card>
          <EmptyState icon="🗓️" message="No exam routine has been published yet." />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Exam Routine"
        description={description}
        action={
          <div className="flex flex-wrap items-center gap-3">
            {terms && terms.length > 1 && (
              <select
                value={termId ?? ""}
                onChange={(e) => setTermId(Number(e.target.value))}
                aria-label="Exam term"
                className="border border-border bg-muted rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            <ExamPrintControls
              termName={term?.name ?? "Exam Routine"}
              termNote={term?.note ?? null}
              exams={exams}
              allowSittingSheet={allowSittingSheet}
              defaultBatchId={scope === "mine" ? ownBatchId : null}
              disabled={exams.length === 0}
            />
          </div>
        }
      />

      <nav className="flex items-center gap-1 border-b border-border" aria-label="Scope">
        {(["mine", "all"] as Scope[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setScope(value)}
            aria-current={scope === value ? "page" : undefined}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px ${
              scope === value
                ? "border-primary text-primary"
                : "border-transparent text-slate hover:text-foreground"
            }`}
          >
            {scopeLabels[value]}
          </button>
        ))}
      </nav>

      {scope === "mine" && !loading && <NextExamCard exam={next} today={today} />}

      <Card>
        <CardHeader
          title={
            <>
              {term?.name ?? "Exam Routine"}
              <span className="ml-2 text-sm font-normal text-slate">
                {exams.length} {exams.length === 1 ? "exam" : "exams"}
              </span>
            </>
          }
          description={term?.note ?? undefined}
        />
        {loading ? (
          <Loading />
        ) : error ? (
          <EmptyState icon="⚠️" message={error} />
        ) : (
          <ExamRoutineTable
            exams={exams}
            today={today}
            showFilters={scope === "all"}
            emptyMessage={scope === "mine" ? emptyMineMessage : "No exams of this kind in this term."}
          />
        )}
      </Card>
    </>
  );
}
