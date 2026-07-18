"use client";

import { useEffect, useState } from "react";
import AdminNav from "../AdminNav";

type TeacherRequest = {
  id: number;
  name: string | null;
  email: string;
  initials: string | null;
  createdAt: string;
};

export default function TeacherRequestsPage() {
  const [requests, setRequests] = useState<TeacherRequest[]>([]);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);

  async function loadRequests() {
    const res = await fetch("/api/admin/teacher-requests");
    const json = await res.json();
    if (json.ok) setRequests(json.data);
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
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">SmartRoutineHub</h1>
            <p className="text-xs text-gray-400 mt-0.5">Admin · Teacher Requests</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-3 py-1 rounded-full">
              {requests.length} pending
            </span>
            <AdminNav />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {status && (
          <div className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${
            status.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            <span className="text-base leading-none mt-0.5">
              {status.type === "success" ? "✓" : "⚠"}
            </span>
            <span>{status.msg}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">
              Pending Teacher Requests
              <span className="ml-2 text-sm font-normal text-gray-400">{requests.length}</span>
            </h2>
          </div>

          {requests.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-gray-300 text-4xl mb-3">📥</p>
              <p className="text-gray-400 text-sm">No pending teacher requests.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wide">
                    <th className="px-5 py-3 text-left font-semibold">Name</th>
                    <th className="px-5 py-3 text-left font-semibold">Email</th>
                    <th className="px-5 py-3 text-left font-semibold">Initials</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-gray-800">{r.name ?? "—"}</td>
                      <td className="px-5 py-3.5 text-gray-600">{r.email}</td>
                      <td className="px-5 py-3.5 text-gray-600">{r.initials ?? "—"}</td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleAction(r.id, "approve")}
                          disabled={actingId === r.id}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-50 mr-3"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(r.id, "reject")}
                          disabled={actingId === r.id}
                          className="text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
