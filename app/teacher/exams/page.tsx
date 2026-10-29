"use client";

// Teacher → Exams (Step 51). Read-only: the published exam routine for the
// courses this teacher takes, or for the whole department.
//
// "My exams" is matched on the course+batch pairs the teacher teaches in
// the published class routine — an Exam has no teacher of its own, since
// invigilation isn't modelled. Teachers also get the room-wise sitting
// sheet, which is what an invigilation desk works from.
import { ExamRoutineView } from "@/components/exams/ExamRoutineView";

export default function TeacherExamsPage() {
  return (
    <ExamRoutineView
      endpoint="/api/teacher/exams"
      scopeLabels={{ mine: "My exams", all: "All exams" }}
      description="Exam dates, times and rooms for the courses you take."
      allowSittingSheet
      emptyMineMessage="None of your courses has an exam of this kind in this term."
    />
  );
}
