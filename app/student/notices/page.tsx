"use client";

/**
 * Student "Notices" — department announcements addressed to everyone or to
 * students (the ALL + STUDENTS filtering happens server-side in
 * GET /api/student/notices). Step 48 restyled the list into cards; same
 * data, same order (newest first, as the endpoint returns them).
 */
import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card } from "@/app/components/ui/Card";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";

type Notice = { id: number; title: string; body: string; audience: string; createdAt: string };

function AudienceBadge({ audience }: { audience: string }) {
  const styles: Record<string, string> = {
    ALL: "bg-primary/10 text-primary",
    STUDENTS: "bg-confirmed/10 text-confirmed",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[audience] ?? "bg-muted text-muted-foreground"}`}>
      {audience === "ALL" ? "Everyone" : "Students"}
    </span>
  );
}

function formatNoticeDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function StudentNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/student/notices")
      .then((res) => res.json())
      .then((json) => {
        if (json.ok) setNotices(json.data);
        else setError(json.error ?? "Failed to load notices.");
      })
      .catch(() => setError("Network error. Please try again."))
      .finally(() => setLoadingState(false));
  }, []);

  return (
    <>
      <PageHeader
        title="Notices"
        description="Announcements from the department."
        action={
          <span className="text-xs bg-primary/10 text-primary font-semibold px-3 py-1 rounded-full font-data">
            {notices.length} notices
          </span>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
        </div>
      ) : error ? (
        <Card>
          <div className="px-6 py-16 text-center">
            <p className="text-muted-foreground/50 text-4xl mb-3">⚠️</p>
            <p className="text-cancelled text-sm">{error}</p>
          </div>
        </Card>
      ) : notices.length === 0 ? (
        <Card>
          <EmptyState icon="📣" message="No notices yet." />
        </Card>
      ) : (
        <div className="space-y-4">
          {notices.map((n) => (
            <article key={n.id} className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <h2 className="font-heading text-base font-semibold text-foreground leading-snug">{n.title}</h2>
                <AudienceBadge audience={n.audience} />
              </div>
              <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{n.body}</p>
              <p className="text-xs text-slate font-data tabular mt-3 pt-3 border-t border-border">
                {formatNoticeDate(n.createdAt)}
              </p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
