"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
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
  batch: { name: string } | null;
  section: string | null;
  status: string;
  originalDate: string | null;
  newDate: string | null;
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

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export default function TeacherRequestsPage() {
  const [requests, setRequests] = useState<RescheduleRequest[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  async function loadRequests() {
    const res = await fetch("/api/teacher/reschedule-requests");
    const json = await res.json();
    if (json.ok) setRequests(json.data);
    setLoadingState(false);
  }

  useEffect(() => { loadRequests(); }, []);

  async function handleCancel(id: number) {
    if (!confirm("Cancel this reschedule request?")) return;
    setCancellingId(id);
    try {
      const res = await fetch(`/api/teacher/reschedule-requests/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        setStatus({ type: "success", msg: "Request cancelled." });
        await loadRequests();
      } else {
        setStatus({ type: "error", msg: json.error ?? "Failed to cancel request." });
      }
    } catch {
      setStatus({ type: "error", msg: "Network error. Please try again." });
    } finally {
      setCancellingId(null);
      setTimeout(() => setStatus(null), 3000);
    }
  }

  return (
    <>
      <PageHeader title="My Requests" description="Your reschedule requests and their approval status." />

      {status && <Message type={status.type}>{status.msg}</Message>}

      <Card>
        <CardHeader title={<>Requests <span className="ml-2 text-sm font-normal text-slate">{requests.length}</span></>} />

        {loading ? (
          <Loading />
        ) : requests.length === 0 ? (
          <EmptyState icon="🔄" message="You haven't submitted any reschedule requests yet." />
        ) : (
          <Table headers={["Class", "From", "To", "Reason", "Status", "Admin Note", ""]}>
            {requests.map((r) => (
              <tr key={r.id} className="hover:bg-muted/40 transition-colors align-top">
                <td className="px-5 py-3.5">
                  <span className="font-semibold text-foreground">{r.course?.code}</span>
                  <div className="text-xs text-slate">{r.batch?.name}{r.section ? ` (${r.section})` : ""}</div>
                </td>
                <td className="px-5 py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(r.originalDate) ?? r.oldDay} {r.oldTimeSlot?.label}<br />Room {r.oldRoom?.name}
                </td>
                <td className="px-5 py-3.5 text-xs text-foreground font-medium whitespace-nowrap">
                  {formatDate(r.newDate) ?? r.newDay} {r.newTimeSlot?.label}<br />Room {r.newRoom?.name}
                </td>
                <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-[160px]">{r.reason ?? "—"}</td>
                <td className="px-5 py-3.5"><StatusBadge status={STATUS_LABEL[r.status] ?? "Pending"} /></td>
                <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-[160px]">{r.adminNote ?? "—"}</td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  {r.status === "PENDING" && (
                    <LinkButton tone="danger" loading={cancellingId === r.id} onClick={() => handleCancel(r.id)}>
                      Cancel
                    </LinkButton>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
