"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Table } from "@/app/components/ui/Table";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type HistoryRow = {
  id: number;
  sessionId: number;
  course: { code: string } | null;
  batch: { name: string } | null;
  section: string | null;
  oldDay: string;
  oldTimeSlot: { label: string } | null;
  oldRoom: { name: string } | null;
  newDay: string;
  newTimeSlot: { label: string } | null;
  newRoom: { name: string } | null;
  reason: string | null;
  createdAt: string;
};

export default function TeacherHistoryPage() {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoadingState] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/history")
      .then((res) => res.json())
      .then((json) => { if (json.ok) setHistory(json.data); })
      .finally(() => setLoadingState(false));
  }, []);

  return (
    <>
      <PageHeader title="Reschedule History" description="A record of every change you've made to your classes." />

      <Card>
        <CardHeader title={<>History <span className="ml-2 text-sm font-normal text-slate">{history.length}</span></>} />

        {loading ? (
          <Loading />
        ) : history.length === 0 ? (
          <EmptyState icon="🕘" message="No reschedules yet." />
        ) : (
          <Table headers={["Class", "From", "To", "Reason", "When"]}>
            {history.map((h) => (
              <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3.5">
                  <span className="font-semibold text-gray-800">{h.course?.code ?? "—"}</span>
                  <span className="ml-1.5 text-xs text-gray-400">
                    {h.batch?.name}{h.section ? ` (${h.section})` : ""}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">
                  {h.oldDay} · {h.oldTimeSlot?.label ?? "—"} · Room {h.oldRoom?.name ?? "—"}
                </td>
                <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">
                  {h.newDay} · {h.newTimeSlot?.label ?? "—"} · Room {h.newRoom?.name ?? "—"}
                </td>
                <td className="px-5 py-3.5 text-gray-500">{h.reason ?? "—"}</td>
                <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">
                  {new Date(h.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
