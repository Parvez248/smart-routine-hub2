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
  batch: { name: string; semester: string };
  timeSlot: { label: string; sortOrder: number };
  movedTo: { day: string; timeSlot: { label: string } | null; room: { name: string } | null; date: string | null } | null;
};
