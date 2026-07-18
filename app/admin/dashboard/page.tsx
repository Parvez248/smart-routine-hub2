"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminNav from "../AdminNav";

type Stats = {
  courseCount: number;
  teacherCount: number;
  roomCount: number;
  batchCount: number;
  timeSlotCount: number;
  publishedSessionCount: number;
  cancelledSessionCount: number;
  pendingTeacherRequestCount: number;
  publishedVersionName: string | null;
};

function Tile({ label, value, color, href }: { label: string; value: string | number; color: string; href?: string }) {
  const inner = (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 h-full hover:border-gray-200 transition-colors">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => res.json())
      .then((json) => { if (json.ok) setStats(json.data); });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">SmartRoutineHub</h1>
            <p className="text-xs text-gray-400 mt-0.5">Admin · Dashboard</p>
          </div>
          <AdminNav />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
          <p className="text-xs text-gray-400 font-medium">Published Routine Version</p>
          <p className="text-xl font-bold text-gray-800 mt-1">
            {stats ? stats.publishedVersionName ?? "None published" : "…"}
          </p>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Academic Data</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Tile label="Courses" value={stats?.courseCount ?? "…"} color="text-gray-800" href="/admin/courses" />
            <Tile label="Teachers" value={stats?.teacherCount ?? "…"} color="text-gray-800" href="/admin/teachers" />
            <Tile label="Rooms" value={stats?.roomCount ?? "…"} color="text-gray-800" href="/admin/rooms" />
            <Tile label="Batches" value={stats?.batchCount ?? "…"} color="text-gray-800" href="/admin/batches" />
            <Tile label="Time Slots" value={stats?.timeSlotCount ?? "…"} color="text-gray-800" href="/admin/timeslots" />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Routine</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Tile
              label="Sessions (Published)"
              value={stats?.publishedSessionCount ?? "…"}
              color="text-sky-600"
              href="/admin/routine"
            />
            <Tile
              label="Cancelled Sessions"
              value={stats?.cancelledSessionCount ?? "…"}
              color="text-red-500"
              href="/admin/routine"
            />
            <Tile
              label="Pending Teacher Requests"
              value={stats?.pendingTeacherRequestCount ?? "…"}
              color="text-amber-600"
              href="/admin/teacher-requests"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
