"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BookOpen, Users, DoorOpen, Layers, Clock, CalendarCheck, XCircle, Inbox, RefreshCw } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Loading } from "@/app/components/ui/Loading";

type Stats = {
  courseCount: number;
  teacherCount: number;
  roomCount: number;
  batchCount: number;
  timeSlotCount: number;
  publishedSessionCount: number;
  cancelledSessionCount: number;
  pendingTeacherRequestCount: number;
  pendingRescheduleRequestCount: number;
  publishedVersionName: string | null;
};

// White card, hairline border, no shadow; a 3px top rule in the card's own
// colour; icon beside the label (not a filled tile); the number large, in the
// serif face, with tabular numerals.
function StatCard({
  label, value, icon: Icon, colorVar, href,
}: { label: string; value: string | number; icon: LucideIcon; colorVar: string; href: string }) {
  return (
    <Link href={href} className="block bg-card rounded-lg border border-border overflow-hidden hover:border-primary/40 transition-colors">
      <div className="h-[3px]" style={{ backgroundColor: colorVar }} />
      <div className="px-5 py-4">
        <div className="flex items-center gap-1.5">
          <Icon className="size-4" style={{ color: colorVar }} aria-hidden="true" />
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</span>
        </div>
        <p className="font-heading tabular text-[34px] font-semibold mt-2 leading-none text-foreground">{value}</p>
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoadingState] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => res.json())
      .then((json) => { if (json.ok) setStats(json.data); })
      .finally(() => setLoadingState(false));
  }, []);

  return (
    <>
      <PageHeader title="Dashboard" description="A quick overview of the routine system." />

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="bg-card rounded-lg border border-border px-6 py-4">
            <p className="text-xs text-muted-foreground font-medium">Published Routine Version</p>
            <p className="font-heading text-xl font-semibold text-foreground mt-1">
              {stats?.publishedVersionName ?? "None published"}
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Academic Data</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <StatCard label="Courses" value={stats?.courseCount ?? 0} icon={BookOpen} colorVar="var(--band-1)" href="/admin/data?tab=courses" />
              <StatCard label="Teachers" value={stats?.teacherCount ?? 0} icon={Users} colorVar="var(--band-2)" href="/admin/data?tab=teachers" />
              <StatCard label="Rooms" value={stats?.roomCount ?? 0} icon={DoorOpen} colorVar="var(--band-3)" href="/admin/data?tab=rooms" />
              <StatCard label="Batches" value={stats?.batchCount ?? 0} icon={Layers} colorVar="var(--band-4)" href="/admin/data?tab=batches" />
              <StatCard label="Time Slots" value={stats?.timeSlotCount ?? 0} icon={Clock} colorVar="var(--band-x)" href="/admin/data?tab=timeslots" />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Routine</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Sessions Published"
                value={stats?.publishedSessionCount ?? 0}
                icon={CalendarCheck}
                colorVar="var(--confirmed)"
                href="/admin/routine"
              />
              <StatCard
                label="Cancelled Sessions"
                value={stats?.cancelledSessionCount ?? 0}
                icon={XCircle}
                colorVar="var(--cancelled)"
                href="/admin/routine"
              />
              <StatCard
                label="Pending Teacher Requests"
                value={stats?.pendingTeacherRequestCount ?? 0}
                icon={Inbox}
                colorVar="var(--pending)"
                href="/admin/people?tab=requests"
              />
              <StatCard
                label="Pending Reschedule Requests"
                value={stats?.pendingRescheduleRequestCount ?? 0}
                icon={RefreshCw}
                colorVar="var(--pending)"
                href="/admin/people?tab=reschedules"
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
