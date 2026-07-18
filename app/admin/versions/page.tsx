"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { Table } from "@/app/components/ui/Table";
import { Message } from "@/app/components/ui/Message";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Loading } from "@/app/components/ui/Loading";

type Version = {
  id: number;
  name: string;
  isPublished: boolean;
  effectiveDate: string | null;
  sessionCount: number;
};

type VersionForm = { name: string; effectiveDate: string };
const emptyForm: VersionForm = { name: "", effectiveDate: "" };

export default function VersionsPage() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoadingState] = useState(true);
  const [form, setForm] = useState<VersionForm>(emptyForm);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);

  async function loadVersions() {
    const res = await fetch("/api/admin/versions");
    const json = await res.json();
    if (json.ok) setVersions(json.data);
    setLoadingState(false);
  }

  useEffect(() => { loadVersions(); }, []);

  function flash(type: "success" | "error", msg: string) {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 3000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          effectiveDate: form.effectiveDate || null,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Version created.");
        setForm(emptyForm);
        await loadVersions();
      } else {
        flash("error", json.error ?? "Failed to create version.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePublish(id: number) {
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/versions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Version published.");
        await loadVersions();
      } else {
        flash("error", json.error ?? "Failed to publish version.");
      }
    } catch {
      flash("error", "Network error. Please try again.");
    } finally {
      setActingId(null);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this version? This cannot be undone.")) return;
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/versions/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        flash("success", "Version deleted.");
        await loadVersions();
      } else {
        flash("error", json.error ?? "Failed to delete version.");
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
        title="Routine Versions"
        description="Only one version can be published at a time."
        action={
          <span className="text-xs bg-indigo-50 text-indigo-600 font-semibold px-3 py-1 rounded-full">
            {versions.length} versions
          </span>
        }
      />

      <Card>
        <CardHeader title="Create Version" accent />
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Fall 2026"
                className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Effective Date <span className="text-gray-300 normal-case font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={form.effectiveDate}
                onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))}
                className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>
          </div>

          {status && <Message type={status.type}>{status.msg}</Message>}

          <div className="flex justify-end">
            <Button type="submit" loading={submitting}>
              {submitting ? "Creating…" : "Create Version"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title={<>Versions <span className="ml-2 text-sm font-normal text-gray-400">{versions.length}</span></>} />

        {loading ? (
          <Loading />
        ) : versions.length === 0 ? (
          <EmptyState icon="🗂️" message="No versions yet. Create one above." />
        ) : (
          <Table headers={["Name", "Effective Date", "Sessions", "Status", ""]}>
            {versions.map((v) => (
              <tr key={v.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-5 py-3.5 font-semibold text-gray-800">{v.name}</td>
                <td className="px-5 py-3.5 text-gray-600">
                  {v.effectiveDate ? new Date(v.effectiveDate).toLocaleDateString() : "—"}
                </td>
                <td className="px-5 py-3.5 text-gray-600">{v.sessionCount}</td>
                <td className="px-5 py-3.5">
                  {v.isPublished ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                      Published
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                      Draft
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  {!v.isPublished && (
                    <LinkButton tone="success" loading={actingId === v.id} onClick={() => handlePublish(v.id)} className="mr-3">
                      Publish
                    </LinkButton>
                  )}
                  <LinkButton tone="danger" muted loading={actingId === v.id} onClick={() => handleDelete(v.id)}>
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
