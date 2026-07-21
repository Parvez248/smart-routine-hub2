"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

function Tile({ label, value, color, href }: { label: string; value: string | number; color: string; href?: string }) {
  const inner = (
    <div className="bg-card rounded-lg border border-border px-5 py-4 h-full hover:border-primary/30 transition-colors">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className={`font-data text-[28px] font-semibold mt-1 leading-none ${color}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
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
            <p className="text-xl font-semibold text-foreground mt-1">
              {stats?.publishedVersionName ?? "None published"}
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Academic Data</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <Tile label="Courses" value={stats?.courseCount ?? 0} color="text-foreground" href="/admin/data?tab=courses" />
              <Tile label="Teachers" value={stats?.teacherCount ?? 0} color="text-foreground" href="/admin/data?tab=teachers" />
              <Tile label="Rooms" value={stats?.roomCount ?? 0} color="text-foreground" href="/admin/data?tab=rooms" />
              <Tile label="Batches" value={stats?.batchCount ?? 0} color="text-foreground" href="/admin/data?tab=batches" />
              <Tile label="Time Slots" value={stats?.timeSlotCount ?? 0} color="text-foreground" href="/admin/data?tab=timeslots" />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Routine</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Tile
                label="Sessions (Published)"
                value={stats?.publishedSessionCount ?? 0}
                color="text-primary"
                href="/admin/routine"
              />
              <Tile
                label="Cancelled Sessions"
                value={stats?.cancelledSessionCount ?? 0}
                color="text-cancelled"
                href="/admin/routine"
              />
              <Tile
                label="Pending Teacher Requests"
                value={stats?.pendingTeacherRequestCount ?? 0}
                color="text-moved"
                href="/admin/people?tab=requests"
              />
              <Tile
                label="Pending Reschedule Requests"
                value={stats?.pendingRescheduleRequestCount ?? 0}
                color="text-moved"
                href="/admin/people?tab=reschedules"
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
