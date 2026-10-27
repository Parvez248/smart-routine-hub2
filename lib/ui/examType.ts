// The exam kinds and how they're written in the UI (Step 49). Mirrors the
// Prisma ExamType enum. Pure and tiny on purpose: both the admin builder's
// client components and lib/services/exams.ts need these, and the client
// side must not import the service, which pulls in the database client.
export type ExamTypeValue = "MIDTERM" | "FINAL";

export const EXAM_TYPES: ExamTypeValue[] = ["MIDTERM", "FINAL"];

export const EXAM_TYPE_LABELS: Record<ExamTypeValue, string> = {
  MIDTERM: "Midterm",
  FINAL: "Final",
};
