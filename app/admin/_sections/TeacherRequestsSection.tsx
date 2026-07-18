"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { LinkButton } from "@/app/components/ui/Button";
import { Table } from "@/app/components/ui/Table";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type TeacherRequest = {
  id: number;
  name: string | null;
  email: string;
  initials: string | null;
  createdAt: string;
};

export default function TeacherRequestsSection() {
  const [requests, setRequests] = useState<TeacherRequest[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);

  async function loadRequests() {
    const res = await fetch("/api/admin/teacher-requests");
    const json = await res.json();
    if (json.ok) setRequests(json.data);
    setLoadingState(false);
  }

  useEffect(() => { loadRequests(); }, []);

  function flash(type: "success" | "error", msg: string) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  }

  async function handleAction(id: number, action: "approve" | "reject") {
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/teacher-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", action === "approve" ? "Teacher approved." : "Teacher rejected.");
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

  return (
    <>
      {status && <Message type={status.type}>{status.msg}</Message>}

      <Card>
        <CardHeader title={<>Pending Teacher Requests <span className="ml-2 text-sm font-normal text-gray-400">{requests.length}</span></>} />

        {loading ? (
          <Loading />
        ) : requests.length === 0 ? (
          <EmptyState icon="📥" message="No pending teacher requests." />
        ) : (
          <Table headers={["Name", "Email", "Initials", ""]}>
            {requests.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3.5 font-semibold text-gray-800">{r.name ?? "—"}</td>
                <td className="px-5 py-3.5 text-gray-600">{r.email}</td>
                <td className="px-5 py-3.5 text-gray-600">{r.initials ?? "—"}</td>
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
    </>
  );
}
