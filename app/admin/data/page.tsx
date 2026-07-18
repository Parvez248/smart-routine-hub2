"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Tabs } from "@/app/components/ui/Tabs";
import { Loading } from "@/app/components/ui/Loading";
import CoursesSection from "../_sections/CoursesSection";
import RoomsSection from "../_sections/RoomsSection";
import TeachersSection from "../_sections/TeachersSection";
import BatchesSection from "../_sections/BatchesSection";
import TimeSlotsSection from "../_sections/TimeSlotsSection";

const TABS = [
  { key: "courses", label: "Courses" },
  { key: "rooms", label: "Rooms" },
  { key: "teachers", label: "Teachers" },
  { key: "batches", label: "Batches" },
  { key: "timeslots", label: "Time Slots" },
];

function AcademicDataInner() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "courses";

  return (
    <>
      <PageHeader title="Academic Data" description="Courses, rooms, teachers, batches, and time slots." />
      <Tabs tabs={TABS} activeKey={tab} />

      {tab === "courses" && <CoursesSection />}
      {tab === "rooms" && <RoomsSection />}
      {tab === "teachers" && <TeachersSection />}
      {tab === "batches" && <BatchesSection />}
      {tab === "timeslots" && <TimeSlotsSection />}
    </>
  );
}

export default function AcademicDataPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AcademicDataInner />
    </Suspense>
  );
}
