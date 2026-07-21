"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type Notice = { id: number; title: string; body: string; audience: string; createdAt: string };

function AudienceBadge({ audience }: { audience: string }) {
  const styles: Record<string, string> = {
    ALL: "bg-primary/10 text-primary",
    TEACHERS: "bg-moved/10 text-moved",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[audience] ?? "bg-muted text-muted-foreground"}`}>
      {audience === "ALL" ? "Everyone" : "Teachers"}
    </span>
  );
}

export default function TeacherNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoadingState] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/notices")
      .then((res) => res.json())
      .then((json) => { if (json.ok) setNotices(json.data); })
      .finally(() => setLoadingState(false));
  }, []);

  return (
    <>
      <PageHeader title="Notices" description="Announcements from the department." />

      <Card>
        <CardHeader title={<>Notices <span className="ml-2 text-sm font-normal text-slate">{notices.length}</span></>} />

        {loading ? (
          <Loading />
        ) : notices.length === 0 ? (
          <EmptyState icon="📣" message="No notices yet." />
        ) : (
          <div className="divide-y divide-border">
            {notices.map((n) => (
              <div key={n.id} className="p-6">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-foreground">{n.title}</h3>
                  <AudienceBadge audience={n.audience} />
                </div>
                <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-wrap">{n.body}</p>
                <p className="text-xs text-slate mt-2">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
