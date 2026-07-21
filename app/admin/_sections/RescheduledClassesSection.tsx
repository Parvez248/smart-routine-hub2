"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { LinkButton } from "@/app/components/ui/Button";
import { Table } from "@/app/components/ui/Table";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";
import { isOnOrAfterToday } from "@/lib/services/dates";

type RescheduledClass = {
  id: number;
  sessionId: number;
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
  adminNote: string | null;
  reviewedAt: string | null;
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function Row({ r, revertingId, onRevert }: { r: RescheduledClass; revertingId: number | null; onRevert: (id: number) => void }) {
  return (
    <tr className="hover:bg-slate-50 transition-colors align-top">
      <td className="px-5 py-3.5">
        <span className="font-semibold text-gray-700">{r.teacher.initials}</span>
        <div className="text-xs text-gray-400">{r.teacher.name}</div>
      </td>
      <td className="px-5 py-3.5">
        <span className="font-medium text-gray-700">{r.course.code}</span>
        <div className="text-xs text-gray-400">{r.batch.name}{r.section ? ` (${r.section})` : ""}</div>
      </td>
      <td className="px-5 py-3.5 text-xs text-gray-500 whitespace-nowrap">
        {formatDate(r.originalDate) ?? r.fromDay} {r.fromTimeSlot?.label}<br />Room {r.fromRoom?.name}
      </td>
      <td className="px-5 py-3.5 text-xs text-gray-700 font-medium whitespace-nowrap">
        {formatDate(r.newDate) ?? r.toDay} {r.toTimeSlot?.label}<br />Room {r.toRoom?.name}
      </td>
      <td className="px-5 py-3.5 text-xs text-gray-500 max-w-[160px]">{r.reason ?? "—"}</td>
      <td className="px-5 py-3.5 text-right whitespace-nowrap">
        <LinkButton tone="warning" loading={revertingId === r.id} onClick={() => onRevert(r.id)}>
          Revert
        </LinkButton>
      </td>
    </tr>
  );
}

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

  const headers = ["Teacher", "Class", "From", "To", "Reason", ""];

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
          <div className="divide-y divide-gray-100">
            {upcoming.length > 0 && (
              <div>
                <h3 className="px-5 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Upcoming</h3>
                <Table headers={headers}>
                  {upcoming.map((r) => <Row key={r.id} r={r} revertingId={revertingId} onRevert={handleRevert} />)}
                </Table>
              </div>
            )}
            {permanent.length > 0 && (
              <div>
                <h3 className="px-5 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Permanent (weekly)</h3>
                <Table headers={headers}>
                  {permanent.map((r) => <Row key={r.id} r={r} revertingId={revertingId} onRevert={handleRevert} />)}
                </Table>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h3 className="px-5 pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Past</h3>
                <Table headers={headers}>
                  {past.map((r) => <Row key={r.id} r={r} revertingId={revertingId} onRevert={handleRevert} />)}
                </Table>
              </div>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
