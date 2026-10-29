"use client";

// "Your next exam" — the one line a student or teacher opening the page
// actually wants (Step 51). Shown only on the personal scopes (My batch /
// My exams), where "next" means something; on the all-batches view it would
// just be whichever exam the department holds soonest.
import { CalendarClock } from "lucide-react";
import { roomLabel } from "@/lib/ui/rooms";
import {
  formatExamDateShort,
  formatTime12,
  relativeDayLabel,
} from "@/lib/ui/examFormat";
import type { ViewExam } from "@/lib/ui/examFormat";
import { courseTitleIfDifferent } from "@/app/components/routine/RowBadges";

export function NextExamCard({ exam, today }: { exam: ViewExam | null; today: string }) {
  if (!exam) return null;
  const title = courseTitleIfDifferent(exam.course);
  const rooms = exam.rooms.length ? exam.rooms.map((r) => roomLabel(r.name)).join(", ") : "room to be announced";

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-5 py-4 print:hidden">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5">
        <CalendarClock className="size-3.5" aria-hidden="true" />
        Next exam
      </p>
      <p className="text-sm font-semibold text-foreground mt-1">
        {exam.course.code}
        {title ? ` — ${title}` : ""}
      </p>
      <p className="text-xs text-muted-foreground font-data mt-0.5">
        {formatExamDateShort(exam.date)} · {formatTime12(exam.startTime)} · {rooms} ·{" "}
        <span className="font-semibold text-primary">{relativeDayLabel(today, exam.date)}</span>
      </p>
    </div>
  );
}
