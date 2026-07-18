"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type SessionCell = {
  id: number;
  day: string;
  section: string | null;
  status: string;
  course: { code: string; type: string };
  teacher: { initials: string; name: string };
  room: { name: string };
  batch: { id: number; name: string; semester: string };
  timeSlot: { id: number; label: string; sortOrder: number };
};

type Batch = { id: number; name: string; semester: string };
type TimeSlot = { id: number; label: string; sortOrder: number };

const DAY_ORDER = ["Sat", "Sun", "Mon", "Tues", "Wed"];

function TypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
      type === "LAB" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
    }`}>
      {type === "LAB" ? "Lab" : "Theory"}
    </span>
  );
}

export default function StudentRoutinePage() {
  const [sessions, setSessions] = useState<SessionCell[]>([]);
  const [versionName, setVersionName] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoadingState] = useState(true);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");

  async function loadRoutine(batchId?: string) {
    setLoadingState(true);
    const url = batchId ? `/api/student/routine?batchId=${batchId}` : "/api/student/routine";
    const res = await fetch(url);
    const json = await res.json();
    if (json.ok) {
      setSessions(json.data.sessions);
      setVersionName(json.data.versionName);
      setMessage(json.data.message);
      setSelectedBatchId(String(json.data.batchId));
    }
    setLoadingState(false);
  }

  useEffect(() => {
    fetch("/api/public/batches").then((res) => res.json()).then((json) => { if (json.ok) setBatches(json.data); });
    fetch("/api/reference").then((res) => res.json()).then((json) => { if (json.ok) setTimeSlots(json.data.timeSlots); });
    loadRoutine();
  }, []);

  function handleBatchChange(batchId: string) {
    setSelectedBatchId(batchId);
    loadRoutine(batchId);
  }

  const cellFor = (day: string, timeSlotId: number) =>
    sessions.filter((s) => s.day === day && s.timeSlot.id === timeSlotId);

  return (
    <>
      <PageHeader
        title="My Routine"
        description={versionName ? `Published version: ${versionName}` : "No routine published yet."}
        action={
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Batch</label>
            <select
              value={selectedBatchId}
              onChange={(e) => handleBatchChange(e.target.value)}
              className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name} — {b.semester} sem</option>
              ))}
            </select>
          </div>
        }
      />

      <Card>
        <CardHeader title="Weekly Routine" />

        {loading ? (
          <Loading />
        ) : message ? (
          <EmptyState icon="🗓️" message={message} />
        ) : sessions.length === 0 ? (
          <EmptyState icon="📭" message="No classes scheduled for this batch." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Time Slot</th>
                  {DAY_ORDER.map((d) => (
                    <th key={d} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {timeSlots.map((slot) => (
                  <tr key={slot.id}>
                    <td className="px-4 py-3 text-gray-500 font-medium whitespace-nowrap align-top">{slot.label}</td>
                    {DAY_ORDER.map((day) => {
                      const cellSessions = cellFor(day, slot.id);
                      return (
                        <td key={day} className="px-4 py-3 align-top min-w-[140px]">
                          {cellSessions.length === 0 ? (
                            <span className="text-gray-200">—</span>
                          ) : (
                            <div className="space-y-2">
                              {cellSessions.map((s) => {
                                const cancelled = s.status === "CANCELLED";
                                return (
                                  <div
                                    key={s.id}
                                    className={`rounded-lg border px-2.5 py-2 ${
                                      cancelled ? "border-red-100 bg-red-50/50" : "border-gray-100 bg-gray-50"
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`font-semibold text-gray-800 ${cancelled ? "line-through text-gray-400" : ""}`}>
                                        {s.course.code}
                                      </span>
                                      <TypeBadge type={s.course.type} />
                                      {cancelled && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                                          Cancelled
                                        </span>
                                      )}
                                    </div>
                                    <p className={`text-xs text-gray-500 mt-1 ${cancelled ? "line-through text-gray-300" : ""}`}>
                                      {s.teacher.initials} · Room {s.room.name}
                                      {s.section ? ` · ${s.section}` : ""}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
