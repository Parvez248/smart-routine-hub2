"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Loading } from "@/app/components/ui/Loading";
import { dayGradient } from "@/lib/ui/dayColors";

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

// The dashboard's four "hero" stat cards — fully gradient-filled, at most 4 per
// screen per the vivid redesign spec. Everything else stays a plain accented tile.
function HeroCard({
  label, value, icon, gradient, href, pulse = false,
}: { label: string; value: string | number; icon: string; gradient: string; href: string; pulse?: boolean }) {
  return (
    <Link
      href={href}
      className="on-gradient print:hidden relative rounded-2xl p-5 h-full text-white shadow-tinted hover:-translate-y-0.5 transition-transform overflow-hidden"
      style={{ backgroundImage: gradient }}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center justify-center size-9 rounded-xl bg-white/20 text-lg">{icon}</span>
        {pulse && Number(value) > 0 && (
          <span className="relative flex size-2.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
            <span className="relative inline-flex size-2.5 rounded-full bg-white" />
          </span>
        )}
      </div>
      <p className="font-heading text-[36px] font-semibold mt-3 leading-none font-data">{value}</p>
      <p className="text-xs mt-1.5 opacity-85">{label}</p>
    </Link>
  );
}

function Tile({ label, value, color, href }: { label: string; value: string | number; color: string; href?: string }) {
  const inner = (
    <div className="bg-card rounded-2xl border border-border px-5 py-4 h-full hover:border-primary/30 transition-colors">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <HeroCard
              label="Courses"
              value={stats?.courseCount ?? 0}
              icon="📚"
              gradient="linear-gradient(135deg, var(--brand-from), var(--brand-to))"
              href="/admin/data?tab=courses"
            />
            <HeroCard
              label="Teachers"
              value={stats?.teacherCount ?? 0}
              icon="🧑‍🏫"
              gradient={dayGradient("Sat")}
              href="/admin/data?tab=teachers"
            />
            <HeroCard
              label="Rooms"
              value={stats?.roomCount ?? 0}
              icon="🚪"
              gradient={dayGradient("Sun")}
              href="/admin/data?tab=rooms"
            />
            <HeroCard
              label="Sessions Published"
              value={stats?.publishedSessionCount ?? 0}
              icon="🗓️"
              gradient={dayGradient("Wed")}
              href="/admin/routine"
            />
          </div>

          <div className="bg-card rounded-2xl border border-border px-6 py-4">
            <p className="text-xs text-muted-foreground font-medium">Published Routine Version</p>
            <p className="text-xl font-semibold text-foreground mt-1">
              {stats?.publishedVersionName ?? "None published"}
            </p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Academic Data</h2>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
              <Tile label="Batches" value={stats?.batchCount ?? 0} color="text-moved" href="/admin/data?tab=batches" />
              <Tile label="Time Slots" value={stats?.timeSlotCount ?? 0} color="text-foreground" href="/admin/data?tab=timeslots" />
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Routine</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Tile
                label="Cancelled Sessions"
                value={stats?.cancelledSessionCount ?? 0}
                color="text-cancelled"
                href="/admin/routine"
              />
              <Tile
                label="Pending Teacher Requests"
                value={stats?.pendingTeacherRequestCount ?? 0}
                color="text-pending"
                href="/admin/people?tab=requests"
              />
              <Tile
                label="Pending Reschedule Requests"
                value={stats?.pendingRescheduleRequestCount ?? 0}
                color="text-pending"
                href="/admin/people?tab=reschedules"
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
