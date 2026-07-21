"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { LinkButton } from "@/app/components/ui/Button";
import { Table } from "@/app/components/ui/Table";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";
import { StatusBadge, type Status } from "@/app/components/ui/StatusBadge";

type RescheduleRequest = {
  id: number;
  sessionId: number;
  course: { code: string } | null;
  teacher: { initials: string; name: string } | null;
  batch: { name: string } | null;
  section: string | null;
  status: string;
  oldDay: string;
  oldTimeSlot: { label: string } | null;
  oldRoom: { name: string } | null;
  newDay: string;
  newTimeSlot: { label: string } | null;
  newRoom: { name: string } | null;
  reason: string | null;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<string, Status> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

function MoveDescription({ r }: { r: RescheduleRequest }) {
  return (
    <div className="text-xs font-data">
      <span className="text-slate">{r.oldDay} {r.oldTimeSlot?.label} · Room {r.oldRoom?.name}</span>
      <span className="mx-1.5 text-muted-foreground/50">→</span>
      <span className="font-semibold text-foreground">{r.newDay} {r.newTimeSlot?.label} · Room {r.newRoom?.name}</span>
    </div>
  );
}

export default function RescheduleRequestsSection() {
  const [requests, setRequests] = useState<RescheduleRequest[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);
  const [noteById, setNoteById] = useState<Record<number, string>>({});

  async function loadRequests() {
    const res = await fetch("/api/admin/reschedule-requests");
    const json = await res.json();
    if (json.ok) setRequests(json.data);
    setLoadingState(false);
  }

  useEffect(() => { loadRequests(); }, []);

  function flash(type: "success" | "error", msg: string) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 4000);
  }

  async function handleAction(id: number, action: "approve" | "reject") {
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/reschedule-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote: noteById[id]?.trim() || null }),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", action === "approve" ? "Reschedule approved — the class has been moved." : "Reschedule rejected.");
        await loadRequests();
      } else {
        flash("error", json.error ?? "Failed to update request.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setActingId(null);
    }
  }

  const pending = requests.filter((r) => r.status === "PENDING");
  const history = requests.filter((r) => r.status !== "PENDING");

  return (
    <>
      {status && <Message type={status.type}>{status.msg}</Message>}

      <Card>
        <CardHeader title={<>Pending Reschedule Requests <span className="ml-2 text-sm font-normal text-slate">{pending.length}</span></>} />

        {loading ? (
          <Loading />
        ) : pending.length === 0 ? (
          <EmptyState icon="🔄" message="No pending reschedule requests." />
        ) : (
          <Table headers={["Teacher", "Class", "Move", "Reason", "Note", ""]}>
            {pending.map((r) => (
              <tr key={r.id} className="hover:bg-muted/40 transition-colors align-top">
                <td className="px-5 py-3.5">
                  <span className="font-semibold font-data text-foreground">{r.teacher?.initials}</span>
                  <div className="text-xs text-slate">{r.teacher?.name}</div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="font-medium font-data text-foreground">{r.course?.code}</span>
                  <div className="text-xs text-slate">
                    {r.batch?.name}{r.section ? ` (${r.section})` : ""}
                  </div>
                </td>
                <td className="px-5 py-3.5"><MoveDescription r={r} /></td>
                <td className="px-5 py-3.5 text-muted-foreground text-xs max-w-[160px]">{r.reason ?? "—"}</td>
                <td className="px-5 py-3.5">
                  <input
                    type="text"
                    value={noteById[r.id] ?? ""}
                    onChange={(e) => setNoteById((m) => ({ ...m, [r.id]: e.target.value }))}
                    placeholder="Optional note"
                    className="w-36 border border-border bg-card rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <LinkButton tone="success" loading={actingId === r.id} onClick={() => handleAction(r.id, "approve")} className="mr-3">
                    Approve
                  </LinkButton>
                  <LinkButton tone="danger" loading={actingId === r.id} onClick={() => handleAction(r.id, "reject")}>
                    Reject
                  </LinkButton>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title={<>Decided Requests <span className="ml-2 text-sm font-normal text-slate">{history.length}</span></>} />

        {!loading && history.length === 0 ? (
          <EmptyState icon="🗂️" message="No decided requests yet." />
        ) : (
          <Table headers={["Teacher", "Class", "Move", "Status", "Note", "Decided"]}>
            {history.map((r) => (
              <tr key={r.id} className="hover:bg-muted/40 transition-colors align-top">
                <td className="px-5 py-3.5">
                  <span className="font-semibold font-data text-foreground">{r.teacher?.initials}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className="font-medium font-data text-foreground">{r.course?.code}</span>
                  <div className="text-xs text-slate">
                    {r.batch?.name}{r.section ? ` (${r.section})` : ""}
                  </div>
                </td>
                <td className="px-5 py-3.5"><MoveDescription r={r} /></td>
                <td className="px-5 py-3.5"><StatusBadge status={STATUS_LABEL[r.status] ?? "Pending"} /></td>
                <td className="px-5 py-3.5 text-muted-foreground text-xs max-w-[160px]">{r.adminNote ?? "—"}</td>
                <td className="px-5 py-3.5 text-slate text-xs whitespace-nowrap font-data">
                  {r.reviewedAt ? new Date(r.reviewedAt).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
