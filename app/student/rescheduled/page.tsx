"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Table } from "@/app/components/ui/Table";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type RescheduledClass = {
  id: number;
  course: { code: string };
  teacher: { initials: string; name: string };
  batch: { id: number; name: string };
  section: string | null;
  fromDay: string;
  fromTimeSlot: { label: string } | null;
  fromRoom: { name: string } | null;
  toDay: string;
  toTimeSlot: { label: string } | null;
  toRoom: { name: string } | null;
  reason: string | null;
};

export default function StudentRescheduledPage() {
  const [items, setItems] = useState<RescheduledClass[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [myBatchId, setMyBatchId] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/rescheduled").then((res) => res.json()),
      fetch("/api/student/routine").then((res) => res.json()),
    ]).then(([rescheduledJson, routineJson]) => {
      if (rescheduledJson.ok) setItems(rescheduledJson.data);
      if (routineJson.ok) setMyBatchId(Number(routineJson.data.batchId));
    }).finally(() => setLoadingState(false));
  }, []);

  const visible = useMemo(() => {
    if (showAll || myBatchId === null) return items;
    return items.filter((r) => r.batch.id === myBatchId);
  }, [items, showAll, myBatchId]);

  return (
    <>
      <PageHeader
        title="Rescheduled Classes"
        description={showAll ? "Every class currently moved across the department." : "Classes moved from their regular position for your batch."}
        action={
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-xs font-semibold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors"
          >
            {showAll ? "Show my batch only" : "Show all batches"}
          </button>
        }
      />

      <Card>
        <CardHeader title={<>Active Reschedules <span className="ml-2 text-sm font-normal text-gray-400">{visible.length}</span></>} />

        {loading ? (
          <Loading />
        ) : visible.length === 0 ? (
          <EmptyState icon="🔄" message="No classes are currently rescheduled." />
        ) : (
          <Table headers={["Class", "Teacher", "From", "To", "Reason"]}>
            {visible.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors align-top">
                <td className="px-5 py-3.5">
                  <span className="font-medium text-gray-700">{r.course.code}</span>
                  <div className="text-xs text-gray-400">{r.batch.name}{r.section ? ` (${r.section})` : ""}</div>
                </td>
                <td className="px-5 py-3.5 text-gray-600">{r.teacher.initials}</td>
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
