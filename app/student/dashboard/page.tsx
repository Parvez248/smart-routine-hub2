"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { CalendarDays, AlarmClock, LogOut, CalendarCheck, CalendarRange, BellRing } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { WelcomeBanner } from "@/app/components/dashboard/WelcomeBanner";
import { StatCard } from "@/app/components/dashboard/StatCard";
import { SectionCard } from "@/app/components/dashboard/SectionCard";
import { MiniClassRow } from "@/app/components/dashboard/MiniClassRow";
import { dayNameForDate } from "@/lib/services/dates";
import { nextOccurrenceOf } from "@/lib/services/timeslot";
import { APP_SUBTITLE } from "@/lib/config/app";
import type { FilterableSession } from "@/app/components/routine/types";

type RoutineSession = FilterableSession & { id: number };
type Batch = { id: number; name: string; semester: string };
type Alarm = { id: number; sessionId: number; leadMinutes: number; isActive: boolean };
type Notice = { id: number; title: string; body: string; createdAt: string };

function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return `${minutes}m ${totalSeconds % 60}s`;
}

export default function StudentDashboardPage() {
  const { data: session } = useSession();
  const name = session?.user?.name || session?.user?.email || "Student";

  const [sessions, setSessions] = useState<RoutineSession[]>([]);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [routineLoading, setRoutineLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [alarmsLoading, setAlarmsLoading] = useState(true);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticesLoading, setNoticesLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    document.title = "Dashboard · Routine Management System";
  }, []);

  useEffect(() => {
    fetch("/api/student/routine")
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setSessions(json.data.sessions);
          setBatchId(json.data.batchId);
          setMessage(json.data.message);
        }
      })
      .finally(() => setRoutineLoading(false));
    fetch("/api/public/batches").then((r) => r.json()).then((json) => { if (json.ok) setBatches(json.data); });
    fetch("/api/student/alarms").then((r) => r.json()).then((json) => { if (json.ok) setAlarms(json.data); }).finally(() => setAlarmsLoading(false));
    fetch("/api/student/notices").then((r) => r.json()).then((json) => { if (json.ok) setNotices(json.data); }).finally(() => setNoticesLoading(false));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const batchName = useMemo(() => {
    const b = batches.find((x) => x.id === batchId);
    return b ? `${b.name} · ${b.semester} sem` : null;
  }, [batches, batchId]);

  const todayName = dayNameForDate(now);
  const todaysClasses = useMemo(
    () => sessions.filter((s) => s.day === todayName).sort((a, b) => a.timeSlot.sortOrder - b.timeSlot.sortOrder),
    [sessions, todayName]
  );
  const activeReminderCount = useMemo(() => alarms.filter((a) => a.isActive).length, [alarms]);

  const nextClass = useMemo(() => {
    const upcoming = sessions
      .filter((s) => s.status !== "CANCELLED")
      .map((s) => ({ session: s, at: nextOccurrenceOf(s.day, s.timeSlot.label, now) }))
      .filter((x): x is { session: RoutineSession; at: Date } => x.at !== null)
      .sort((a, b) => a.at.getTime() - b.at.getTime());
    return upcoming[0] ?? null;
  }, [sessions, now]);

  return (
    <>
      <PageHeader title="Dashboard" description="Your routine and reminders at a glance." />

      <WelcomeBanner
        name={name}
        subtitle={`Student${batchName ? ` · ${batchName}` : ""} · ${APP_SUBTITLE}`}
        actions={[
          { label: "My Routine", href: "/student/routine", icon: CalendarDays, tone: "solid" },
          { label: "Reminders", href: "/student/alarms", icon: AlarmClock },
          { label: "Logout", onClick: () => signOut({ callbackUrl: "/login" }), icon: LogOut },
        ]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard loading={routineLoading} label="Today's Classes" value={todaysClasses.length} icon={CalendarCheck} color="var(--confirmed)" />
        <StatCard loading={routineLoading} label="This Week's Classes" value={sessions.length} icon={CalendarRange} color="var(--band-2)" />
        <StatCard loading={alarmsLoading} label="Active Reminders" value={activeReminderCount} icon={BellRing} color="var(--pending)" href="/student/alarms" />
      </div>

      {nextClass && (
        <div className="bg-card rounded-lg border border-border px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Next Class</p>
            <p className="text-lg font-bold mt-0.5 text-foreground">
              {nextClass.session.course.code} · {nextClass.session.day} · {nextClass.session.timeSlot.label}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {nextClass.session.teacher.initials} · Room {nextClass.session.room.name}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Starts in</p>
            <p className="text-2xl font-bold tabular-nums text-primary">{formatCountdown(nextClass.at.getTime() - now.getTime())}</p>
          </div>
        </div>
      )}

      <SectionCard title="Today's Classes" viewAllHref="/student/routine">
        {routineLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : message ? (
          <EmptyState icon="🗓️" message={message} />
        ) : todaysClasses.length > 0 ? (
          <div>
            {todaysClasses.map((s) => <MiniClassRow key={s.id} session={s} />)}
          </div>
        ) : (
          <EmptyState icon="📭" message="No classes today." />
        )}
      </SectionCard>

      <SectionCard title="Notices" viewAllHref="/student/notices">
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
    </>
  );
}
