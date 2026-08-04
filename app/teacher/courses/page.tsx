"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";
import { TypePill } from "@/app/components/routine/RowBadges";

type ClassSession = {
  id: number;
  section: string | null;
  course: { id: number; code: string; title: string; type: string };
  batch: { id: number; name: string; semester: string };
};

type CourseCard = {
  id: number;
  code: string;
  title: string;
  type: string;
  classCount: number;
  batches: string[];
};

// One card per distinct course the teacher teaches this week, derived from
// their own published-routine sessions (the same data "My Classes" already
// fetches) — no new endpoint.
function deriveCourses(sessions: ClassSession[]): CourseCard[] {
  const byId = new Map<number, CourseCard>();
  for (const s of sessions) {
    const label = s.batch.name + (s.section ? ` · ${s.section}` : "");
    const existing = byId.get(s.course.id);
    if (existing) {
      existing.classCount++;
      if (!existing.batches.includes(label)) existing.batches.push(label);
    } else {
      byId.set(s.course.id, {
        id: s.course.id,
        code: s.course.code,
        title: s.course.title,
        type: s.course.type,
        classCount: 1,
        batches: [label],
      });
    }
  }
  return [...byId.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export default function TeacherCoursesPage() {
  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/classes")
      .then((r) => r.json())
      .then((json) => { if (json.ok) setCourses(deriveCourses(json.data)); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="My Courses"
        description="The distinct courses you teach in the published routine."
        action={
          <span className="text-xs bg-primary/10 text-primary font-semibold px-3 py-1 rounded-full font-data">
            {courses.length} courses
          </span>
        }
      />

      {loading ? (
        <Loading />
      ) : courses.length === 0 ? (
        <EmptyState icon="📚" message="You have no courses yet." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => (
            <div key={c.id} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-heading text-base font-semibold text-foreground leading-snug">{c.title}</h2>
                <TypePill type={c.type} batch={{ semester: "" }} />
              </div>
              <p className="font-data text-xs text-muted-foreground mt-1">{c.code}</p>

              <div className="mt-3.5 pt-3 border-t border-border flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  {c.batches.join(", ")}
                </span>
                <span className="shrink-0 font-semibold text-foreground font-data">
                  {c.classCount} {c.classCount === 1 ? "class" : "classes"}/wk
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
