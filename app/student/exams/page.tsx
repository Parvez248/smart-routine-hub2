"use client";

// Student → Exams (Step 51). Read-only: the published exam routine for the
// student's own batch, or for every batch.
//
// "My batch" filters by batch only, never by section — the Student model
// records no section (the same known limitation as /student/routine), so
// both sections' exams are listed and each row shows which section it is
// for.
import { ExamRoutineView } from "@/components/exams/ExamRoutineView";

export default function StudentExamsPage() {
  return (
    <ExamRoutineView
      endpoint="/api/student/exams"
      scopeLabels={{ mine: "My batch", all: "All batches" }}
      description="Midterm and final exam dates, times and rooms."
      emptyMineMessage="Your batch has no exams of this kind in this term."
    />
  );
}
