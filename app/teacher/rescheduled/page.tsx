"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Table } from "@/app/components/ui/Table";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type RescheduledClass = {
  id: number;
  course: { code: string };
  teacher: { initials: string; name: string };
  batch: { name: string };
  section: string | null;
  fromDay: string;
  fromTimeSlot: { label: string } | null;
  fromRoom: { name: string } | null;
  toDay: string;
  toTimeSlot: { label: string } | null;
  toRoom: { name: string } | null;
  reason: string | null;
};

export default function TeacherRescheduledPage() {
  const [items, setItems] = useState<RescheduledClass[]>([]);
  const [loading, setLoadingState] = useState(true);

  useEffect(() => {
    fetch("/api/rescheduled")
      .then((res) => res.json())
      .then((json) => { if (json.ok) setItems(json.data); })
      .finally(() => setLoadingState(false));
  }, []);

  return (
    <>
      <PageHeader
        title="Rescheduled Classes"
        description="Every class currently moved from its regular position across the department."
      />

      <Card>
        <CardHeader title={<>Active Reschedules <span className="ml-2 text-sm font-normal text-gray-400">{items.length}</span></>} />

        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <EmptyState icon="🔄" message="No classes are currently rescheduled." />
        ) : (
          <Table headers={["Teacher", "Class", "From", "To", "Reason"]}>
            {items.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors align-top">
                <td className="px-5 py-3.5">
                  <span className="font-semibold text-gray-700">{r.teacher.initials}</span>
                  <div className="text-xs text-gray-400">{r.teacher.name}</div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="font-medium text-gray-700">{r.course.code}</span>
                  <div className="text-xs text-gray-400">{r.batch.name}{r.section ? ` (${r.section})` : ""}</div>
                </td>
                <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                  {r.fromDay} {r.fromTimeSlot?.label}<br />Room {r.fromRoom?.name}
                </td>
                <td className="px-5 py-3.5 text-xs text-gray-700 font-medium whitespace-nowrap">
                  {r.toDay} {r.toTimeSlot?.label}<br />Room {r.toRoom?.name}
                </td>
                <td className="px-5 py-3.5 text-xs text-gray-500 max-w-[200px]">{r.reason ?? "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
