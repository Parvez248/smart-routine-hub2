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
  // `sectionCount` (1 or 2) is the batch's own section setting — Step 50
  // made it the single source for "does this batch have sections?", which
  // the grid needs to decide whether to draw one row or a Sec 1 + Sec 2
  // pair. Every routine API returns the full batch row, so it's always present.
  batch: { name: string; semester: string; sectionCount: number };
  timeSlot: { label: string; sortOrder: number };
  movedTo: { day: string; timeSlot: { label: string } | null; room: { name: string } | null; date: string | null } | null;
};
