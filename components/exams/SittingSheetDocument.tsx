// The room-wise sitting sheet (Step 51) — portrait A4, one block per date
// and sitting, listing every room with who sits in it and how many of its
// seats are taken.
//
// This is the paper form of the Step 49b rule that rooms are shared: the
// hall holds several batches in one sitting, and what matters on the day is
// the per-room total, not which batch "booked" it.
import { sectionLabel } from "@/lib/ui/sections";
import { roomLabel } from "@/lib/ui/rooms";
import { formatExamDate } from "@/lib/ui/examFormat";
import type { SittingSheetDay } from "@/lib/ui/examFormat";
import { EXAM_SITTING_LABELS, EXAM_TYPE_LABELS } from "@/lib/ui/examType";
import type { ExamTypeValue } from "@/lib/ui/examType";

export function SittingSheetDocument({
  termName,
  type,
  days,
  isDraft,
  printedOn,
}: {
  termName: string;
  type: ExamTypeValue;
  days: SittingSheetDay[];
  isDraft: boolean;
  printedOn: string;
}) {
  return (
    <section className="exam-page">
      {isDraft && <div className="draft-mark">DRAFT</div>}

      <div style={{ textAlign: "center", marginBottom: "10pt" }}>
        <p style={{ fontSize: "12pt", fontWeight: 700, margin: 0 }}>Hamdard University Bangladesh</p>
        <p style={{ fontSize: "10pt", margin: "2pt 0 0" }}>Department of Computer Science and Engineering</p>
        <p style={{ fontSize: "11pt", fontWeight: 700, margin: "6pt 0 0" }}>Exam Routine — {termName}</p>
        <p style={{ fontSize: "10pt", margin: "2pt 0 0" }}>
          Room-wise Sitting Sheet — {EXAM_TYPE_LABELS[type]}
        </p>
      </div>

      {days.length === 0 ? (
        <p style={{ fontSize: "9pt", fontStyle: "italic" }}>
          No {EXAM_TYPE_LABELS[type].toLowerCase()} exams are scheduled.
        </p>
      ) : (
        days.map((day) => (
          <div key={day.date}>
            {day.blocks.map((block) => (
              <div className="sheet-block" key={`${day.date}-${block.sitting}`} style={{ marginBottom: "12pt" }}>
                <h2 style={{ fontSize: "10.5pt", fontWeight: 700, margin: "0 0 4pt" }}>
                  {formatExamDate(day.date)} ({day.weekday}) — {EXAM_SITTING_LABELS[block.sitting]} ·{" "}
                  {block.timeRange}
                </h2>

                {block.rooms.map((room) => (
                  <div key={room.name} style={{ marginBottom: "7pt" }}>
                    <p style={{ fontSize: "9.5pt", fontWeight: 600, margin: "0 0 2pt" }}>
                      {roomLabel(room.name)} — {room.seatsUsed} / {room.capacity} seats
                      {room.hasUnknownSeats && (
                        <span style={{ fontWeight: 400, fontStyle: "italic" }}> (seats not set)</span>
                      )}
                    </p>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: "16%" }}>Batch</th>
                          <th style={{ width: "14%" }}>Sec</th>
                          <th>Course</th>
                          <th style={{ width: "27%" }}>Time</th>
                          <th style={{ width: "12%" }}>Seats</th>
                        </tr>
                      </thead>
                      <tbody>
                        {room.rows.map((row, i) => (
                          <tr key={`${row.batch}-${row.course}-${i}`}>
                            <td>{row.batch}</td>
                            <td>{sectionLabel(row.section) ?? "—"}</td>
                            <td>
                              {row.course}
                              {row.isLab ? " (LAB)" : ""}
                            </td>
                            <td>{row.time}</td>
                            <td>{row.seats === null ? "—" : row.seats}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))
      )}

      <p style={{ fontSize: "8.5pt", marginTop: "14pt", textAlign: "right" }}>Printed on {printedOn}</p>
    </section>
  );
}
