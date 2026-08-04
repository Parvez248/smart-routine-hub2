"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { GraduationCap, CalendarDays, LogOut, CalendarCheck, CalendarRange, BookOpen, RefreshCw } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge, type Status } from "@/app/components/ui/StatusBadge";
import { WelcomeBanner } from "@/app/components/dashboard/WelcomeBanner";
import { StatCard } from "@/app/components/dashboard/StatCard";
import { SectionCard } from "@/app/components/dashboard/SectionCard";
import { MiniClassRow } from "@/app/components/dashboard/MiniClassRow";
import { dayNameForDate } from "@/lib/services/dates";
import { nextOccurrenceOf } from "@/lib/services/timeslot";
import { APP_SUBTITLE } from "@/lib/config/app";
import type { FilterableSession } from "@/app/components/routine/types";

type RoutineSession = FilterableSession & { id: number };

type RescheduleRequest = {
  id: number;
  course: { code: string } | null;
  batch: { name: string } | null;
  section: string | null;
  status: string;
  newDay: string;
  newTimeSlot: { label: string } | null;
  createdAt: string;
};

type Notice = { id: number; title: string; body: string; createdAt: string };

const STATUS_LABEL: Record<string, Status> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function TeacherDashboardPage() {
  const { data: session } = useSession();
  const name = session?.user?.name || session?.user?.email || "Teacher";

  const [classes, setClasses] = useState<RoutineSession[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [requests, setRequests] = useState<RescheduleRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticesLoading, setNoticesLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    document.title = "Dashboard · Routine Management System";
  }, []);

  useEffect(() => {
    fetch("/api/teacher/classes").then((r) => r.json()).then((json) => { if (json.ok) setClasses(json.data); }).finally(() => setClassesLoading(false));
    fetch("/api/teacher/reschedule-requests").then((r) => r.json()).then((json) => { if (json.ok) setRequests(json.data); }).finally(() => setRequestsLoading(false));
    fetch("/api/teacher/notices").then((r) => r.json()).then((json) => { if (json.ok) setNotices(json.data); }).finally(() => setNoticesLoading(false));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const todayName = dayNameForDate(now);
  const todaysClasses = useMemo(
    () => classes.filter((c) => c.day === todayName).sort((a, b) => a.timeSlot.sortOrder - b.timeSlot.sortOrder),
    [classes, todayName]
  );
  const courseCount = useMemo(() => new Set(classes.map((c) => c.course.code)).size, [classes]);
  const pendingRequestCount = useMemo(() => requests.filter((r) => r.status === "PENDING").length, [requests]);

  const nextClass = useMemo(() => {
    if (todaysClasses.length > 0) return null;
    const upcoming = classes
      .filter((c) => c.status !== "CANCELLED")
      .map((c) => ({ session: c, at: nextOccurrenceOf(c.day, c.timeSlot.label, now) }))
      .filter((x): x is { session: RoutineSession; at: Date } => x.at !== null)
      .sort((a, b) => a.at.getTime() - b.at.getTime());
    return upcoming[0] ?? null;
  }, [classes, todaysClasses, now]);

  return (
    <>
      <PageHeader title="Dashboard" description="Your classes and requests at a glance." />

      <WelcomeBanner
        name={name}
        subtitle={`Teacher · ${APP_SUBTITLE}`}
        actions={[
          { label: "My Classes", href: "/teacher/classes", icon: GraduationCap, tone: "solid" },
          { label: "Full Routine", href: "/teacher/routine", icon: CalendarDays },
          { label: "Logout", onClick: () => signOut({ callbackUrl: "/login" }), icon: LogOut },
        ]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard loading={classesLoading} label="Today's Classes" value={todaysClasses.length} icon={CalendarCheck} color="var(--confirmed)" />
        <StatCard loading={classesLoading} label="This Week's Classes" value={classes.length} icon={CalendarRange} color="var(--band-2)" />
        <StatCard loading={classesLoading} label="My Courses" value={courseCount} icon={BookOpen} color="var(--band-1)" href="/teacher/courses" />
        <StatCard
          loading={requestsLoading}
          label="My Pending Requests"
          value={pendingRequestCount}
          icon={RefreshCw}
          color="var(--pending)"
          href="/teacher/requests"
        />
      </div>

      <SectionCard
        title={todaysClasses.length > 0 ? "Today's Classes" : "Next Class"}
        viewAllHref="/teacher/routine"
      >
        {classesLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : todaysClasses.length > 0 ? (
          <div>
            {todaysClasses.map((c) => <MiniClassRow key={c.id} session={c} />)}
          </div>
        ) : nextClass ? (
          <div className="px-5 py-4">
            <p className="text-xs text-muted-foreground mb-2">No classes today — your next class:</p>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <MiniClassRow session={nextClass.session} />
              <span className="font-data tabular text-sm font-semibold text-primary whitespace-nowrap">
                in {formatCountdown(nextClass.at.getTime() - now.getTime())}
              </span>
            </div>
          </div>
        ) : (
          <EmptyState icon="📭" message="No classes today." />
        )}
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="My Reschedule Requests" viewAllHref="/teacher/requests">
          {requestsLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : requests.length === 0 ? (
            <EmptyState icon="🔄" message="No reschedule requests yet." />
          ) : (
            <div className="divide-y divide-border">
              {requests.slice(0, 3).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <p className="text-sm text-foreground truncate min-w-0">
                    <span className="font-data font-semibold">{r.course?.code ?? "—"}</span>
                    {" "}→ {r.newDay} {r.newTimeSlot?.label ?? ""}
                  </p>
                  <StatusBadge status={STATUS_LABEL[r.status] ?? "Pending"} className="shrink-0" />
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Notices" viewAllHref="/teacher/notices">
          {noticesLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : notices.length === 0 ? (
            <EmptyState icon="📣" message="No notices yet." />
          ) : (
            <div className="divide-y divide-border">
              {notices.slice(0, 3).map((n) => (
                <div key={n.id} className="px-5 py-3">
                  <p className="text-sm font-semibold text-foreground truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{n.body}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
