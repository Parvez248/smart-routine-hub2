"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Table } from "@/app/components/ui/Table";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type RoutineSession = {
  id: number;
  day: string;
  section: string | null;
  status: string;
  course: { code: string; type: string };
  teacher: { initials: string; name: string };
  room: { name: string };
  batch: { id: number; name: string; semester: string };
  timeSlot: { id: number; label: string; sortOrder: number };
  movedTo: { day: string; timeSlot: { label: string } | null; room: { name: string } | null } | null;
};

type Batch = { id: number; name: string; semester: string };

const DAYS = ["Sat", "Sun", "Mon", "Tues", "Wed"];

export default function TeacherRoutinePage() {
  const [sessions, setSessions] = useState<RoutineSession[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [dayFilter, setDayFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");

  async function loadRoutine() {
    setLoadingState(true);
    const params = new URLSearchParams();
    if (dayFilter !== "all") params.set("day", dayFilter);
    if (batchFilter !== "all") params.set("batchId", batchFilter);
    const res = await fetch(`/api/teacher/routine?${params.toString()}`);
    const json = await res.json();
    if (json.ok) setSessions(json.data);
    setLoadingState(false);
  }

  useEffect(() => {
    fetch("/api/reference")
      .then((res) => res.json())
      .then((json) => { if (json.ok) setBatches(json.data.batches); });
  }, []);

  useEffect(() => { loadRoutine(); }, [dayFilter, batchFilter]);

  return (
    <>
      <PageHeader
        title="Full Department Routine"
        description="Every published class across all batches — read-only. This is not just your own classes."
      />

      <Card>
        <CardHeader
          title={<>Routine <span className="ml-2 text-sm font-normal text-gray-400">{sessions.length} classes</span></>}
        />

        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-4">
          <div className="flex gap-1 flex-wrap">
            {["all", ...DAYS].map((d) => (
              <button
                key={d}
                onClick={() => setDayFilter(d)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  dayFilter === d ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {d === "all" ? "All Days" : d}
              </button>
            ))}
          </div>

          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} — {b.semester} sem</option>
            ))}
          </select>
        </div>

        {loading ? (
          <Loading />
        ) : sessions.length === 0 ? (
          <EmptyState icon="📚" message="No classes match this filter." />
        ) : (
          <Table headers={["Day", "Time Slot", "Batch", "Course", "Teacher", "Room", "Status"]}>
            {sessions.map((s) => (
              <tr
                key={s.id}
                className={`hover:bg-slate-50 transition-colors ${s.status === "CANCELLED" ? "bg-gray-50/60 opacity-60" : ""}`}
              >
                <td className="px-5 py-3.5 font-semibold text-gray-700">{s.day}</td>
                <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{s.timeSlot.label}</td>
                <td className="px-5 py-3.5">
                  <span className="font-medium text-gray-700">{s.batch.name}</span>
                  {s.section && (
                    <span className="ml-1.5 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{s.section}</span>
                  )}
                </td>
                <td className="px-5 py-3.5 font-semibold text-gray-800">
                  {s.course.code}
                  {s.status !== "CANCELLED" && s.movedTo && (
                    <div className="mt-1 text-xs font-normal text-amber-700">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 mr-1">
                        Moved
                      </span>
                      to {s.movedTo.day}, {s.movedTo.timeSlot?.label}, Room {s.movedTo.room?.name}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <span className="font-medium text-gray-700">{s.teacher.initials}</span>
                  <span className="ml-1.5 text-xs text-gray-400 hidden sm:inline">{s.teacher.name}</span>
                </td>
                <td className="px-5 py-3.5 text-gray-600">Room {s.room.name}</td>
                <td className="px-5 py-3.5">
                  {s.status === "CANCELLED" ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                      Cancelled
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                      Active
                    </span>
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
