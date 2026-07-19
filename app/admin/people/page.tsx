"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Tabs } from "@/app/components/ui/Tabs";
import { Loading } from "@/app/components/ui/Loading";
import TeacherRequestsSection from "../_sections/TeacherRequestsSection";
import NoticesSection from "../_sections/NoticesSection";
import RescheduleRequestsSection from "../_sections/RescheduleRequestsSection";

function PeopleInner() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "requests";
  const [pendingCount, setPendingCount] = useState<number | undefined>(undefined);
  const [pendingRescheduleCount, setPendingRescheduleCount] = useState<number | undefined>(undefined);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => res.json())
      .then((json) => {
        if (json.ok) {
          setPendingCount(json.data.pendingTeacherRequestCount);
          setPendingRescheduleCount(json.data.pendingRescheduleRequestCount);
        }
      });
  }, [tab]);

  const tabs = [
    { key: "requests", label: "Teacher Requests", badge: pendingCount },
    { key: "reschedules", label: "Reschedule Requests", badge: pendingRescheduleCount },
    { key: "notices", label: "Notices" },
  ];

  return (
    <>
      <PageHeader title="People & Notices" description="Teacher approvals, reschedule requests, and department announcements." />
      <Tabs tabs={tabs} activeKey={tab} />

      {tab === "requests" && <TeacherRequestsSection />}
      {tab === "reschedules" && <RescheduleRequestsSection />}
      {tab === "notices" && <NoticesSection />}
    </>
  );
}

export default function PeoplePage() {
  return (
    <Suspense fallback={<Loading />}>
      <PeopleInner />
    </Suspense>
  );
}
