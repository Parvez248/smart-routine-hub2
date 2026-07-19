"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { LinkButton } from "@/app/components/ui/Button";
import { Table } from "@/app/components/ui/Table";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type RescheduledClass = {
  id: number;
  sessionId: number;
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
  adminNote: string | null;
  reviewedAt: string | null;
};

export default function RescheduledClassesSection() {
  const [items, setItems] = useState<RescheduledClass[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [revertingId, setRevertingId] = useState<number | null>(null);

  async function loadItems() {
    const res = await fetch("/api/rescheduled");
    const json = await res.json();
    if (json.ok) setItems(json.data);
    setLoadingState(false);
  }

  useEffect(() => { loadItems(); }, []);

  async function handleRevert(id: number) {
    if (!confirm("Revert this class back to its original position?")) return;
    setRevertingId(id);
    try {
      const res = await fetch(`/api/admin/reschedule-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revert" }),
      });
      const json = await res.json();
      if (json.ok) {
        setStatus({ type: "success", msg: "Class reverted to its original position." });
        await loadItems();
      } else {
        setStatus({ type: "error", msg: json.error ?? "Failed to revert." });
      }
    } catch {
      setStatus({ type: "error", msg: "Network error. Please try again." });
    } finally {
      setRevertingId(null);
      setTimeout(() => setStatus(null), 4000);
    }
  }

  return (
    <>
      {status && <Message type={status.type}>{status.msg}</Message>}

      <Card>
        <CardHeader
          title={<>Rescheduled Classes <span className="ml-2 text-sm font-normal text-gray-400">{items.length}</span></>}
          description="Active overrides on top of the master routine. Reverting restores the class's original position."
        />

        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <EmptyState icon="🔄" message="No classes are currently rescheduled." />
        ) : (
          <Table headers={["Teacher", "Class", "From", "To", "Reason", ""]}>
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
                <td className="px-5 py-3.5 text-xs text-gray-500 max-w-[160px]">{r.reason ?? "—"}</td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <LinkButton tone="warning" loading={revertingId === r.id} onClick={() => handleRevert(r.id)}>
                    Revert
                  </LinkButton>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
