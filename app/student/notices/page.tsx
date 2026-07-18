"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type Notice = { id: number; title: string; body: string; audience: string; createdAt: string };

function AudienceBadge({ audience }: { audience: string }) {
  const styles: Record<string, string> = {
    ALL: "bg-indigo-100 text-indigo-700",
    STUDENTS: "bg-sky-100 text-sky-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[audience] ?? "bg-gray-100 text-gray-600"}`}>
      {audience === "ALL" ? "Everyone" : "Students"}
    </span>
  );
}

export default function StudentNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoadingState] = useState(true);

  useEffect(() => {
    fetch("/api/student/notices")
      .then((res) => res.json())
      .then((json) => { if (json.ok) setNotices(json.data); })
      .finally(() => setLoadingState(false));
  }, []);

  return (
    <>
      <PageHeader title="Notices" description="Announcements from the department." />

      <Card>
        <CardHeader title={<>Notices <span className="ml-2 text-sm font-normal text-gray-400">{notices.length}</span></>} />

        {loading ? (
          <Loading />
        ) : notices.length === 0 ? (
          <EmptyState icon="📣" message="No notices yet." />
        ) : (
          <div className="divide-y divide-gray-50">
            {notices.map((n) => (
              <div key={n.id} className="p-6">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-800">{n.title}</h3>
                  <AudienceBadge audience={n.audience} />
                </div>
                <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-wrap">{n.body}</p>
                <p className="text-xs text-gray-400 mt-2">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
