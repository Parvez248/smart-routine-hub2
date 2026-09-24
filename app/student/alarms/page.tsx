"use client";

/**
 * Student "Reminders" — the alarms the student has set on their own
 * classes. Step 48 restyled this from a dense table into one card per
 * reminder (so the class, its lead time, its on/off state and delete all
 * read clearly on mobile too); the API calls and their behaviour —
 * PATCH leadMinutes, PATCH isActive, DELETE — are unchanged.
 */
import { useEffect, useState } from "react";
import { BellRing, Trash2 } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { LinkButton } from "@/app/components/ui/Button";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { StatusBadge } from "@/app/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/app/components/ui/Card";

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

  const activeCount = alarms.filter((a) => a.isActive).length;

  return (
    <>
      <PageHeader
        title="Reminders"
        description="Reminders fire as an on-screen banner (and a browser notification, if allowed) while this site is open."
        action={
          <span className="text-xs bg-primary/10 text-primary font-semibold px-3 py-1 rounded-full font-data">
            {activeCount} active · {alarms.length} total
          </span>
        }
      />

      {status && <Message type={status.type}>{status.msg}</Message>}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-lg" />)}
        </div>
      ) : alarms.length === 0 ? (
        <Card>
          <EmptyState icon="🔔" message="No reminders yet — set one from the bell icon on My Routine." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {alarms.map((a) => {
            const cancelled = a.session?.status === "CANCELLED";
            const busy = actingId === a.id;
            return (
              <div
                key={a.id}
                className={`bg-card border border-border rounded-lg p-4 ${a.isActive ? "" : "opacity-70"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`font-data font-semibold text-base ${
                          cancelled ? "text-muted-foreground line-through" : "text-foreground"
                        }`}
                      >
                        {a.session?.course.code ?? "—"}
                      </span>
                      {cancelled && <StatusBadge status="Cancelled" />}
                    </div>
                    <p className="text-xs text-muted-foreground font-data mt-1">
                      {a.session ? `${a.session.day} · ${a.session.timeSlot.label}` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground font-data mt-0.5">
                      {a.session ? `Room ${a.session.room.name}` : "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(a)}
                    disabled={busy}
                    aria-pressed={a.isActive}
                    aria-label={a.isActive ? "Reminder on — turn off" : "Reminder off — turn on"}
                    className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold disabled:opacity-50 transition-colors ${
                      a.isActive ? "bg-confirmed/10 text-confirmed" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <BellRing className="size-3" aria-hidden="true" />
                    {a.isActive ? "On" : "Off"}
                  </button>
                </div>

                <div className="mt-3.5 pt-3 border-t border-border flex items-end justify-between gap-3">
                  <div className="flex flex-col gap-1 min-w-0">
                    <label
                      htmlFor={`lead-${a.id}`}
                      className="text-[10px] uppercase tracking-wide text-muted-foreground/70 font-medium"
                    >
                      Remind me before
                    </label>
                    <select
                      id={`lead-${a.id}`}
                      value={a.leadMinutes}
                      disabled={busy}
                      onChange={(e) => handleLeadChange(a.id, Number(e.target.value))}
                      className="border border-border bg-muted rounded-lg px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    >
                      {LEAD_OPTIONS.map((m) => (
                        <option key={m} value={m}>{m} min</option>
                      ))}
                    </select>
                  </div>
                  <LinkButton
                    tone="danger"
                    muted
                    loading={busy}
                    onClick={() => handleDelete(a.id)}
                    className="p-1 rounded"
                    title="Remove reminder"
                    aria-label={`Remove reminder for ${a.session?.course.code ?? "this class"}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </LinkButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
