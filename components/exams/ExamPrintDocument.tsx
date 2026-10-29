// The printed exam routine (Step 51) — portrait A4, one page per batch, in
// the format the department already uses on paper. Plain markup and inline
// styles only: this renders inside ExamPrintSurface's portal, where the
// page's own screen styling doesn't apply and everything must be
// ink-friendly by construction.
import { sectionLabel } from "@/lib/ui/sections";
import { roomLabel } from "@/lib/ui/rooms";
import { formatExamDate, isLab, padCount, weekdayOf } from "@/lib/ui/examFormat";
import type { PrintBatchGroup, ViewExam } from "@/lib/ui/examFormat";
import { formatTimeRange } from "@/lib/ui/examFormat";

export type PrintWhich = "both" | "midterm" | "final";

function ExamTable({ exams, emptyMessage }: { exams: ViewExam[]; emptyMessage: string }) {
  if (exams.length === 0) {
    return <p style={{ fontSize: "9pt", fontStyle: "italic", margin: "4pt 0 10pt" }}>{emptyMessage}</p>;
  }
  return (
    <table style={{ marginBottom: "10pt" }}>
      <thead>
        <tr>
          <th style={{ width: "21%" }}>Date</th>
          <th style={{ width: "15%" }}>Course Code</th>
          <th>Course Title</th>
          <th style={{ width: "10%" }}>Sec</th>
          <th style={{ width: "21%" }}>Time</th>
          <th style={{ width: "15%" }}>Room(s)</th>
        </tr>
      </thead>
      <tbody>
        {exams.map((exam) => (
          <tr key={exam.id}>
            <td>
              {formatExamDate(exam.date)}
              <br />
              <span style={{ fontSize: "8pt" }}>{weekdayOf(exam.date)}</span>
            </td>
            <td style={{ fontWeight: 600 }}>
              {exam.course.code}
              {isLab(exam) ? " (LAB)" : ""}
            </td>
            <td>{exam.course.title}</td>
            <td>{sectionLabel(exam.section) ?? "—"}</td>
            <td>{formatTimeRange(exam.startTime, exam.endTime)}</td>
            <td>{exam.rooms.length ? exam.rooms.map((r) => roomLabel(r.name)).join(", ") : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Masthead({ termName, batch }: { termName: string; batch: { name: string; semester: string } }) {
  return (
    <div style={{ textAlign: "center", marginBottom: "10pt" }}>
      <p style={{ fontSize: "12pt", fontWeight: 700, margin: 0 }}>Hamdard University Bangladesh</p>
      <p style={{ fontSize: "10pt", margin: "2pt 0 0" }}>Department of Computer Science and Engineering</p>
      <p style={{ fontSize: "11pt", fontWeight: 700, margin: "6pt 0 0" }}>Exam Routine — {termName}</p>
      <p style={{ fontSize: "10pt", margin: "2pt 0 0" }}>
        Batch {batch.name} ({batch.semester})
      </p>
    </div>
  );
}

export function ExamPrintDocument({
  termName,
  termNote,
  isDraft,
  groups,
  which,
  printedOn,
}: {
  termName: string;
  termNote: string | null;
  isDraft: boolean;
  groups: PrintBatchGroup[];
  which: PrintWhich;
  printedOn: string;
}) {
  const showMidterm = which !== "final";
  const showFinal = which !== "midterm";

  if (groups.length === 0) {
    return (
      <div className="exam-page">
        <p style={{ fontSize: "11pt", textAlign: "center", marginTop: "40pt" }}>
          There are no exams to print for this selection.
        </p>
      </div>
    );
  }

  return (
    <>
      {groups.map((group) => (
        <section className="exam-page" key={group.batch.id}>
          {/* A draft term is still printable for the admin's own checking,
              but it must never be mistaken for the published routine. */}
          {isDraft && <div className="draft-mark">DRAFT</div>}

          <Masthead termName={termName} batch={group.batch} />

          <p style={{ textAlign: "center", fontSize: "9.5pt", fontWeight: 600, margin: "0 0 10pt" }}>
            Midterm Exams {padCount(group.counts.midterm)} · Final Exams {padCount(group.counts.final)} · Lab Exams{" "}
            {padCount(group.counts.lab)}
          </p>

          {showMidterm && (
            <>
              <h2 style={{ fontSize: "10.5pt", fontWeight: 700, margin: "0 0 4pt" }}>Midterm Examination</h2>
              <ExamTable exams={group.midterm} emptyMessage="No midterm exams scheduled." />
            </>
          )}

          {showFinal && (
            <>
              <h2 style={{ fontSize: "10.5pt", fontWeight: 700, margin: "0 0 4pt" }}>Final Examination</h2>
              <ExamTable exams={group.final} emptyMessage="No final exams scheduled." />
            </>
          )}

          {termNote && (
            <p style={{ fontSize: "9pt", marginTop: "8pt" }}>
              <strong>Note:</strong> {termNote}
            </p>
          )}

          <p style={{ fontSize: "8.5pt", marginTop: "14pt", textAlign: "right" }}>Printed on {printedOn}</p>
        </section>
      ))}
    </>
  );
}
