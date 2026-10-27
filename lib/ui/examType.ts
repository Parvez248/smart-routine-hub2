// The exam enums and how they're written in the UI. Mirrors the Prisma
// ExamType and ExamSitting enums. Pure and tiny on purpose: both the admin
// builder's client components and lib/services/exams.ts need these, and the
// client side must not import the service, which pulls in the database client.
export type ExamTypeValue = "MIDTERM" | "FINAL";

export const EXAM_TYPES: ExamTypeValue[] = ["MIDTERM", "FINAL"];

export const EXAM_TYPE_LABELS: Record<ExamTypeValue, string> = {
  MIDTERM: "Midterm",
  FINAL: "Final",
};

// Exams run in two sittings a day (Step 49b). The sitting — not the clock
// time — is what clashes and room capacity are grouped by, because the real
// question is "is this room full for this sitting", not "do these overlap".
export type ExamSittingValue = "MORNING" | "AFTERNOON";

export const EXAM_SITTINGS: ExamSittingValue[] = ["MORNING", "AFTERNOON"];

export const EXAM_SITTING_LABELS: Record<ExamSittingValue, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
};
