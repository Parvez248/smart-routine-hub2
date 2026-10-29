// The subset of session fields the routine filter system needs. All three routine
// views (admin/teacher/student) already fetch richer objects that satisfy this shape.
export type FilterableSession = {
  id: number;
  day: string;
  section: string | null;
  status: string;
  course: { code: string; title: string; type: string };
  teacher: { initials: string; name: string };
  room: { name: string };
  // `id` is what a special block is matched against (Step 52 — a block can
  // apply to named batches rather than all of them), and `sectionCount`
  // (Step 50) is the batch's own section setting — the single source for
  // "does this batch have sections?", which the grid needs to decide
  // whether to draw one row or a Sec 1 + Sec 2 pair. Every routine API
  // returns the full batch row, so both are always present.
  batch: { id: number; name: string; semester: string; sectionCount: number };
  // `startTime` ("HH:MM", Step 52) is what the next-class countdown and the
  // student reminders schedule against. Optional because it is only needed
  // by those two callers, and null for a period whose times were never
  // filled in — both of which fall back to parsing `label`, as before.
  timeSlot: { label: string; sortOrder: number; startTime?: string | null };
  movedTo: { day: string; timeSlot: { label: string } | null; room: { name: string } | null; date: string | null } | null;
};
