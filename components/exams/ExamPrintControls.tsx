"use client";

// The Print / Save as PDF button and its options dialog (Step 51), shared
// by the admin builder and the teacher and student pages so all three print
// the same documents.
//
// There is no PDF library: the documents are rendered as plain HTML and
// handed to the browser's own print dialog, where "Save as PDF" produces
// the file. That is the same approach the class routine has used since
// Step 46, and it keeps the output identical to what the page shows.
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { buildSittingSheet, formatExamDate, groupForPrint, todayInDhaka } from "@/lib/ui/examFormat";
import type { ViewExam } from "@/lib/ui/examFormat";
import type { ExamTypeValue } from "@/lib/ui/examType";
import { ExamPrintSurface } from "./ExamPrintSurface";
import { ExamPrintDocument } from "./ExamPrintDocument";
import type { PrintWhich } from "./ExamPrintDocument";
import { SittingSheetDocument } from "./SittingSheetDocument";

type What = "routine" | "sheet";

function Choice({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              value === o.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExamPrintControls({
  termName,
  termNote = null,
  isDraft = false,
  exams,
  allowSittingSheet = false,
  defaultBatchId = null,
  disabled = false,
}: {
  termName: string;
  termNote?: string | null;
  isDraft?: boolean;
  exams: ViewExam[];
  /** The sitting sheet is offered to admins and teachers, not to students. */
  allowSittingSheet?: boolean;
  /** Pre-select one batch — the student's own. */
  defaultBatchId?: number | null;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [job, setJob] = useState<number | null>(null);

  const [what, setWhat] = useState<What>("routine");
  const [which, setWhich] = useState<PrintWhich>("both");
  const [batchChoice, setBatchChoice] = useState<string>(defaultBatchId ? String(defaultBatchId) : "all");

  const batches = useMemo(() => {
    const seen = new Map<number, { id: number; name: string; semester: string }>();
    for (const e of exams) seen.set(e.batch.id, e.batch);
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [exams]);

  const printedOn = formatExamDate(todayInDhaka());
  const types: ExamTypeValue[] =
    which === "both" ? ["MIDTERM", "FINAL"] : which === "midterm" ? ["MIDTERM"] : ["FINAL"];

  // The routine honours the batch choice; the sitting sheet never does —
  // it is a room-wise view, so leaving a batch out would make the seat
  // totals wrong.
  const routineGroups = useMemo(() => {
    const selected = exams.filter((e) => batchChoice === "all" || String(e.batch.id) === batchChoice);
    // Counts in the summary line describe the batch's whole schedule, so
    // they are taken before narrowing — but a batch with nothing of the
    // chosen kind gets no page at all, rather than a blank one.
    return groupForPrint(selected).filter((g) =>
      which === "midterm"
        ? g.midterm.length > 0
        : which === "final"
          ? g.final.length > 0
          : g.midterm.length > 0 || g.final.length > 0
    );
  }, [exams, batchChoice, which]);

  const sheetsByType = useMemo(
    () => types.map((type) => ({ type, days: buildSittingSheet(exams.filter((e) => e.type === type)) })),
    // `types` is derived from `which`, so that is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exams, which]
  );

  function startPrint() {
    setOpen(false);
    // A new number each time, so printing twice in a row re-renders and
    // re-prints rather than doing nothing the second time.
    setJob(Date.now());
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} disabled={disabled} className="gap-1.5">
        <Printer className="size-3.5" aria-hidden="true" />
        Print / Save as PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Print options</DialogTitle>
            <DialogDescription>
              Choose what to print, then use your browser&apos;s Print dialog → Save as PDF.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {allowSittingSheet && (
              <Choice
                label="What"
                value={what}
                onChange={(v) => setWhat(v as What)}
                options={[
                  { value: "routine", label: "Exam routine" },
                  { value: "sheet", label: "Room-wise sitting sheet" },
                ]}
              />
            )}

            {what === "routine" && (
              <Choice
                label="Batch"
                value={batchChoice}
                onChange={setBatchChoice}
                options={[
                  { value: "all", label: "All batches (one page each)" },
                  ...batches.map((b) => ({ value: String(b.id), label: `${b.name} — ${b.semester} sem` })),
                ]}
              />
            )}

            <Choice
              label="Exams"
              value={which}
              onChange={(v) => setWhich(v as PrintWhich)}
              options={[
                { value: "both", label: "Midterm and Final" },
                { value: "midterm", label: "Midterm only" },
                { value: "final", label: "Final only" },
              ]}
            />
          </div>

          <div className="flex justify-end gap-4 pt-2">
            <LinkButton type="button" tone="neutral" onClick={() => setOpen(false)}>
              Cancel
            </LinkButton>
            <Button type="button" onClick={startPrint}>
              Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ExamPrintSurface job={job} onDone={() => setJob(null)}>
        {what === "routine" ? (
          <ExamPrintDocument
            termName={termName}
            termNote={termNote}
            isDraft={isDraft}
            groups={routineGroups}
            which={which}
            printedOn={printedOn}
          />
        ) : (
          sheetsByType.map(({ type, days }) => (
            <SittingSheetDocument
              key={type}
              termName={termName}
              type={type}
              days={days}
              isDraft={isDraft}
              printedOn={printedOn}
            />
          ))
        )}
      </ExamPrintSurface>
    </>
  );
}
