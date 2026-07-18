"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Tabs } from "@/app/components/ui/Tabs";
import { Loading } from "@/app/components/ui/Loading";
import ScheduleSection from "../_sections/ScheduleSection";
import VersionsSection from "../_sections/VersionsSection";

const TABS = [
  { key: "schedule", label: "Schedule" },
  { key: "versions", label: "Versions" },
];

function RoutineInner() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "schedule";

  return (
    <>
      <PageHeader
        title="Routine"
        description="Conflicts in room, teacher, and batch, and room capacity are checked automatically."
      />
      <Tabs tabs={TABS} activeKey={tab} />

      {tab === "schedule" && <ScheduleSection />}
      {tab === "versions" && <VersionsSection />}
    </>
  );
}

export default function RoutinePage() {
  return (
    <Suspense fallback={<Loading />}>
      <RoutineInner />
    </Suspense>
  );
}
