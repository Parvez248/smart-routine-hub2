"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { LinkButton } from "@/app/components/ui/Button";
import { Table } from "@/app/components/ui/Table";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type AlarmRow = {
  id: number;
  leadMinutes: number;
  isActive: boolean;
  session: {
    day: string;
    status: string;
    course: { code: string };
    room: { name: string };
    timeSlot: { label: string };
  } | null;
};

const LEAD_OPTIONS = [5, 10, 15, 30, 60];

export default function StudentAlarmsPage() {
  const [alarms, setAlarms] = useState<AlarmRow[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);

  async function loadAlarms() {
    const res = await fetch("/api/student/alarms");
    const json = await res.json();
    if (json.ok) setAlarms(json.data);
    setLoadingState(false);
  }

  useEffect(() => { loadAlarms(); }, []);

  function flash(type: "success" | "error", msg: string) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  }

  async function handleLeadChange(id: number, leadMinutes: number) {
    setActingId(id);
    try {
      const res = await fetch(`/api/student/alarms/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadMinutes }),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Reminder updated.");
        await loadAlarms();
      } else {
        flash("error", json.error ?? "Failed to update reminder.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setActingId(null);
    }
  }

  async function handleToggleActive(alarm: AlarmRow) {
    setActingId(alarm.id);
    try {
      const res = await fetch(`/api/student/alarms/${alarm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !alarm.isActive }),
      });
      const json = await res.json();
      if (json.ok) {
        await loadAlarms();
      } else {
        flash("error", json.error ?? "Failed to update reminder.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setActingId(null);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Remove this reminder?")) return;
    setActingId(id);
    try {
      const res = await fetch(`/api/student/alarms/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Reminder removed.");
        await loadAlarms();
      } else {
        flash("error", json.error ?? "Failed to remove reminder.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Reminders"
        description="Reminders fire as an on-screen banner (and a browser notification, if allowed) while this site is open."
        action={
          <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-3 py-1 rounded-full">
            {alarms.length} reminders
          </span>
        }
      />

      {status && <Message type={status.type}>{status.msg}</Message>}

      <Card>
        <CardHeader title={<>Reminders <span className="ml-2 text-sm font-normal text-gray-400">{alarms.length}</span></>} />

        {loading ? (
          <Loading />
        ) : alarms.length === 0 ? (
          <EmptyState icon="🔔" message="No reminders yet. Set one from the bell icon on My Routine." />
        ) : (
          <Table headers={["Class", "Day · Time", "Room", "Remind me before", "Active", ""]}>
            {alarms.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3.5">
                  <span className="font-semibold text-gray-800">{a.session?.course.code ?? "—"}</span>
                  {a.session?.status === "CANCELLED" && (
                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                      Cancelled
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">
                  {a.session ? `${a.session.day} · ${a.session.timeSlot.label}` : "—"}
                </td>
                <td className="px-5 py-3.5 text-gray-600">{a.session ? `Room ${a.session.room.name}` : "—"}</td>
                <td className="px-5 py-3.5">
                  <select
                    value={a.leadMinutes}
                    disabled={actingId === a.id}
                    onChange={(e) => handleLeadChange(a.id, Number(e.target.value))}
                    className="border border-gray-200 bg-gray-50 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {LEAD_OPTIONS.map((m) => (
                      <option key={m} value={m}>{m} min</option>
                    ))}
                  </select>
                </td>
                <td className="px-5 py-3.5">
                  <button
                    onClick={() => handleToggleActive(a)}
                    disabled={actingId === a.id}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold disabled:opacity-50 transition-colors ${
                      a.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {a.isActive ? "On" : "Off"}
                  </button>
                </td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <LinkButton tone="danger" muted loading={actingId === a.id} onClick={() => handleDelete(a.id)}>
                    Delete
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
