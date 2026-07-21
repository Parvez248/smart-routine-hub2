"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Table } from "@/app/components/ui/Table";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";
import { isOnOrAfterToday } from "@/lib/services/dates";

type RescheduledClass = {
  id: number;
  course: { code: string };
  teacher: { initials: string; name: string };
  batch: { name: string };
  section: string | null;
  kind: "dated" | "legacy";
  originalDate: string | null;
  newDate: string | null;
  fromDay: string;
  fromTimeSlot: { label: string } | null;
  fromRoom: { name: string } | null;
  toDay: string;
  toTimeSlot: { label: string } | null;
  toRoom: { name: string } | null;
  reason: string | null;
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function Row({ r }: { r: RescheduledClass }) {
  return (
    <tr className="hover:bg-muted/40 transition-colors align-top">
      <td className="px-5 py-3.5">
        <span className="font-semibold font-data text-foreground">{r.teacher.initials}</span>
        <div className="text-xs text-slate">{r.teacher.name}</div>
      </td>
      <td className="px-5 py-3.5">
        <span className="font-medium font-data text-foreground">{r.course.code}</span>
        <div className="text-xs text-slate">{r.batch.name}{r.section ? ` (${r.section})` : ""}</div>
      </td>
      <td className="px-5 py-3.5 text-xs text-muted-foreground font-data whitespace-nowrap">
        {formatDate(r.originalDate) ?? r.fromDay} {r.fromTimeSlot?.label}<br />Room {r.fromRoom?.name}
      </td>
      <td className="px-5 py-3.5 text-xs text-foreground font-medium font-data whitespace-nowrap">
        {formatDate(r.newDate) ?? r.toDay} {r.toTimeSlot?.label}<br />Room {r.toRoom?.name}
      </td>
      <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-[200px]">{r.reason ?? "—"}</td>
    </tr>
  );
}

export default function TeacherRescheduledPage() {
  const [items, setItems] = useState<RescheduledClass[]>([]);
  const [loading, setLoadingState] = useState(true);

  useEffect(() => {
    fetch("/api/rescheduled")
      .then((res) => res.json())
      .then((json) => { if (json.ok) setItems(json.data); })
      .finally(() => setLoadingState(false));
  }, []);

  const { upcoming, past, permanent } = useMemo(() => {
    const dated = items.filter((r) => r.kind === "dated");
    const upcoming = dated
      .filter((r) => r.newDate && isOnOrAfterToday(new Date(r.newDate)))
      .sort((a, b) => new Date(a.newDate!).getTime() - new Date(b.newDate!).getTime());
    const past = dated
      .filter((r) => r.newDate && !isOnOrAfterToday(new Date(r.newDate)))
      .sort((a, b) => new Date(b.newDate!).getTime() - new Date(a.newDate!).getTime());
    const permanent = items.filter((r) => r.kind === "legacy");
    return { upcoming, past, permanent };
  }, [items]);

  const headers = ["Teacher", "Class", "From", "To", "Reason"];

  return (
    <>
      <PageHeader
        title="Rescheduled Classes"
        description="Every class currently moved from its regular position across the department."
      />

      <Card>
        <CardHeader title={<>Active Reschedules <span className="ml-2 text-sm font-normal text-slate">{items.length}</span></>} />

        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <EmptyState icon="🔄" message="No classes are currently rescheduled." />
        ) : (
          <div className="divide-y divide-border">
            {upcoming.length > 0 && (
              <div>
                <h3 className="px-5 pt-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Upcoming</h3>
                <Table headers={headers}>{upcoming.map((r) => <Row key={r.id} r={r} />)}</Table>
              </div>
            )}
            {permanent.length > 0 && (
              <div>
                <h3 className="px-5 pt-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Permanent (weekly)</h3>
                <Table headers={headers}>{permanent.map((r) => <Row key={r.id} r={r} />)}</Table>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h3 className="px-5 pt-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Past</h3>
                <Table headers={headers}>{past.map((r) => <Row key={r.id} r={r} />)}</Table>
              </div>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
