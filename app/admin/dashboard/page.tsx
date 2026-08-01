"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { CalendarPlus, Megaphone, LogOut, BookOpen, Users, DoorOpen, Layers, Clock, CalendarCheck, XCircle, Inbox, RefreshCw, Check, X } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { LinkButton } from "@/app/components/ui/Button";
import { WelcomeBanner } from "@/app/components/dashboard/WelcomeBanner";
import { StatCard } from "@/app/components/dashboard/StatCard";
import { SectionCard } from "@/app/components/dashboard/SectionCard";
import { APP_SUBTITLE } from "@/lib/config/app";

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

type Version = { id: number; name: string; isPublished: boolean; effectiveDate: string | null; sessionCount: number };

type TeacherRequest = { id: number; name: string | null; email: string; initials: string | null; createdAt: string };

type RescheduleRequest = {
  id: number;
  course: { code: string } | null;
  teacher: { initials: string } | null;
  batch: { name: string } | null;
  section: string | null;
  status: string;
  newDay: string;
  newTimeSlot: { label: string } | null;
  createdAt: string;
};

function formatEffectiveDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const name = session?.user?.name || session?.user?.email || "Administrator";

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [versions, setVersions] = useState<Version[]>([]);

  const [teacherRequests, setTeacherRequests] = useState<TeacherRequest[]>([]);
  const [rescheduleRequests, setRescheduleRequests] = useState<RescheduleRequest[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [actingKey, setActingKey] = useState<string | null>(null);

  async function loadStats() {
    setStatsLoading(true);
    const [statsRes, versionsRes] = await Promise.all([
      fetch("/api/admin/stats").then((r) => r.json()),
      fetch("/api/admin/versions").then((r) => r.json()),
    ]);
    if (statsRes.ok) setStats(statsRes.data);
    if (versionsRes.ok) setVersions(versionsRes.data);
    setStatsLoading(false);
  }

  async function loadPending() {
    setPendingLoading(true);
    const [trRes, rrRes] = await Promise.all([
      fetch("/api/admin/teacher-requests").then((r) => r.json()),
      fetch("/api/admin/reschedule-requests").then((r) => r.json()),
    ]);
    if (trRes.ok) setTeacherRequests(trRes.data);
    if (rrRes.ok) setRescheduleRequests((rrRes.data as RescheduleRequest[]).filter((r) => r.status === "PENDING"));
    setPendingLoading(false);
  }

  useEffect(() => {
    loadStats();
    loadPending();
  }, []);

  async function handleTeacherAction(id: number, action: "approve" | "reject") {
    setActingKey(`teacher-${id}`);
    try {
      const res = await fetch(`/api/admin/teacher-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.ok) {
        await Promise.all([loadPending(), loadStats()]);
      }
    } finally {
      setActingKey(null);
    }
  }

  async function handleRescheduleAction(id: number, action: "approve" | "reject") {
    setActingKey(`reschedule-${id}`);
    try {
      const res = await fetch(`/api/admin/reschedule-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote: null }),
      });
      const json = await res.json();
      if (json.ok) {
        await Promise.all([loadPending(), loadStats()]);
      }
    } finally {
      setActingKey(null);
    }
  }

  const publishedVersion = versions.find((v) => v.isPublished) ?? null;
  const effective = formatEffectiveDate(publishedVersion?.effectiveDate ?? null);
  const totalPending = teacherRequests.length + rescheduleRequests.length;

  return (
    <>
      <PageHeader title="Dashboard" description="A quick overview of the routine system." />

      <WelcomeBanner
        name={name}
        subtitle={`Administrator · ${APP_SUBTITLE}`}
        actions={[
          { label: "Add class", href: "/admin/routine?tab=schedule", icon: CalendarPlus, tone: "solid" },
          { label: "Post notice", href: "/admin/people?tab=notices", icon: Megaphone },
          { label: "Logout", onClick: () => signOut({ callbackUrl: "/login" }), icon: LogOut },
        ]}
      />

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Academic Data</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <StatCard loading={statsLoading} label="Courses" value={stats?.courseCount ?? 0} icon={BookOpen} color="var(--band-1)" href="/admin/data?tab=courses" />
          <StatCard loading={statsLoading} label="Teachers" value={stats?.teacherCount ?? 0} icon={Users} color="var(--band-2)" href="/admin/data?tab=teachers" />
          <StatCard loading={statsLoading} label="Rooms" value={stats?.roomCount ?? 0} icon={DoorOpen} color="var(--band-3)" href="/admin/data?tab=rooms" />
          <StatCard loading={statsLoading} label="Batches" value={stats?.batchCount ?? 0} icon={Layers} color="var(--band-4)" href="/admin/data?tab=batches" />
          <StatCard loading={statsLoading} label="Time Slots" value={stats?.timeSlotCount ?? 0} icon={Clock} color="var(--band-x)" href="/admin/data?tab=timeslots" />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Routine</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            loading={statsLoading}
            label="Sessions Published"
            value={stats?.publishedSessionCount ?? 0}
            icon={CalendarCheck}
            color="var(--confirmed)"
            href="/admin/routine"
          />
          <StatCard
            loading={statsLoading}
            label="Cancelled Sessions"
            value={stats?.cancelledSessionCount ?? 0}
            icon={XCircle}
            color="var(--cancelled)"
            href="/admin/routine"
          />
          <StatCard
            loading={statsLoading}
            label="Pending Teacher Requests"
            value={stats?.pendingTeacherRequestCount ?? 0}
            icon={Inbox}
            color="var(--pending)"
            href="/admin/people?tab=requests"
          />
          <StatCard
            loading={statsLoading}
            label="Pending Reschedule Requests"
            value={stats?.pendingRescheduleRequestCount ?? 0}
            icon={RefreshCw}
            color="var(--pending)"
            href="/admin/people?tab=reschedules"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Pending actions"
          description={totalPending > 0 ? `${totalPending} item${totalPending === 1 ? "" : "s"} awaiting review` : undefined}
          viewAllHref="/admin/people?tab=requests"
          viewAllLabel="Review all"
        >
          {pendingLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
              ))}
            </div>
          ) : totalPending === 0 ? (
            <EmptyState icon="✅" message="Nothing pending — you're all caught up." />
          ) : (
            <div className="divide-y divide-border">
              {teacherRequests.map((r) => (
                <div key={`t-${r.id}`} className="flex items-center gap-3 px-5 py-3">
                  <Inbox className="size-4 text-pending shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">
                      <span className="font-semibold">{r.name ?? r.email}</span>{r.initials ? ` (${r.initials})` : ""} — teacher account
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <LinkButton
                      tone="success"
                      loading={actingKey === `teacher-${r.id}`}
                      onClick={() => handleTeacherAction(r.id, "approve")}
                      title="Approve"
                      aria-label="Approve"
                      className="p-1.5 rounded hover:bg-confirmed/10"
                    >
                      <Check className="size-4" />
                    </LinkButton>
                    <LinkButton
                      tone="danger"
                      loading={actingKey === `teacher-${r.id}`}
                      onClick={() => handleTeacherAction(r.id, "reject")}
                      title="Reject"
                      aria-label="Reject"
                      className="p-1.5 rounded hover:bg-cancelled/10"
                    >
                      <X className="size-4" />
                    </LinkButton>
                  </div>
                </div>
              ))}
              {rescheduleRequests.map((r) => (
                <div key={`r-${r.id}`} className="flex items-center gap-3 px-5 py-3">
                  <RefreshCw className="size-4 text-pending shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">
                      <span className="font-semibold font-data">{r.course?.code ?? "—"}</span>
                      {" "}· {r.teacher?.initials ?? "—"} → {r.newDay} {r.newTimeSlot?.label ?? ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <LinkButton
                      tone="success"
                      loading={actingKey === `reschedule-${r.id}`}
                      onClick={() => handleRescheduleAction(r.id, "approve")}
                      title="Approve"
                      aria-label="Approve"
                      className="p-1.5 rounded hover:bg-confirmed/10"
                    >
                      <Check className="size-4" />
                    </LinkButton>
                    <LinkButton
                      tone="danger"
                      loading={actingKey === `reschedule-${r.id}`}
                      onClick={() => handleRescheduleAction(r.id, "reject")}
                      title="Reject"
                      aria-label="Reject"
                      className="p-1.5 rounded hover:bg-cancelled/10"
                    >
                      <X className="size-4" />
                    </LinkButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Published routine at a glance" viewAllHref="/admin/routine" viewAllLabel="View routine">
          {statsLoading ? (
            <div className="p-5 space-y-3">
              <div className="h-5 w-40 rounded bg-muted animate-pulse" />
              <div className="h-4 w-56 rounded bg-muted animate-pulse" />
            </div>
          ) : !publishedVersion ? (
            <EmptyState icon="🗓️" message="No published routine version yet." />
          ) : (
            <div className="px-5 py-4 space-y-3">
              <div>
                <p className="font-heading text-lg font-semibold text-foreground">{publishedVersion.name}</p>
                {effective && <p className="text-xs text-muted-foreground mt-0.5">Effective from {effective}</p>}
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-muted-foreground">
                  <span className="font-data tabular font-semibold text-foreground">{stats?.publishedSessionCount ?? 0}</span> classes
                </span>
                <span className="text-muted-foreground">
                  <span className="font-data tabular font-semibold text-cancelled">{stats?.cancelledSessionCount ?? 0}</span> cancelled
                </span>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
