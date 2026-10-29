"use client";

/**
 * Admin "Routine → Versions → Periods & blocks" (Step 52) — one routine
 * version's day structure: its period columns, where its break falls, and
 * its special blocks (Club Activities).
 *
 * Two states matter:
 *  - the version has **no periods of its own**, so it uses the standard set
 *    that every such version shares. That set is shown read-only here,
 *    because editing it would silently change every other version using it;
 *    it is edited in Academic Data → Time Slots. "Use custom periods"
 *    copies it into this version as its own, editable rows.
 *  - the version has **its own periods**, which are edited here and saved as
 *    a whole set (PUT), since the rules that matter — one break, periods in
 *    time order — are rules about the set rather than any one period.
 *
 * A period that already has classes can be relabelled and retimed but not
 * removed or renumbered: the sessions point at its row, so moving it would
 * move those classes. The API refuses it too; this just explains it first.
 */
import { useCallback, useEffect, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button, LinkButton } from "@/app/components/ui/Button";
import { Message } from "@/app/components/ui/Message";
import { Loading } from "@/app/components/ui/Loading";
import { periodSetErrors, periodSummary, type Period } from "@/lib/ui/periods";

type EditablePeriod = {
  // Absent for a period being added; present for one that already exists
  // (and is what ties it to the sessions that use it).
  id?: number;
  label: string;
  sortOrder: number;
  startTime: string;
  endTime: string;
  breakAfter: boolean;
  sessionCount: number;
};

type BlockRow = {
  id: number;
  day: string;
  fromSlot: number;
  toSlot: number;
  label: string;
  subLabel: string | null;
  allBatches: boolean;
  batchIds: number[];
};

type BlockForm = {
  id: number | null;
  day: string;
  fromSlot: string;
  toSlot: string;
  label: string;
  subLabel: string;
  allBatches: boolean;
  batchIds: number[];
};

type Batch = { id: number; name: string; semester: string };

const DAYS = ["Sat", "Sun", "Mon", "Tues", "Wed"];

const inputClass =
  "w-full border border-border bg-surface rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

function emptyBlockForm(periods: EditablePeriod[]): BlockForm {
  const last = periods[periods.length - 1]?.sortOrder ?? 1;
  return {
    id: null,
    day: "Wed",
    fromSlot: String(periods[0]?.sortOrder ?? 1),
    toSlot: String(last),
    label: "Club Activities",
    subLabel: "",
    allBatches: true,
    batchIds: [],
  };
}

export function PeriodsDialog({
  open,
  onOpenChange,
  version,
  batches,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: { id: number; name: string } | null;
  batches: Batch[];
  onChanged: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [isOwn, setIsOwn] = useState(false);
  const [periods, setPeriods] = useState<EditablePeriod[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [blockForm, setBlockForm] = useState<BlockForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [blockSaving, setBlockSaving] = useState(false);

  const versionId = version?.id ?? null;

  const load = useCallback(async () => {
    if (!versionId) return;
    setLoading(true);
    setError(null);
    const [periodsRes, blocksRes] = await Promise.all([
      fetch(`/api/admin/versions/${versionId}/periods`).then((r) => r.json()),
      fetch(`/api/admin/versions/${versionId}/special-blocks`).then((r) => r.json()),
    ]);
    if (periodsRes.ok) {
      setIsOwn(periodsRes.data.isOwn);
      setPeriods(
        periodsRes.data.periods.map((p: Period & { sessionCount: number }) => ({
          id: p.id,
          label: p.label,
          sortOrder: p.sortOrder,
          startTime: p.startTime ?? "",
          endTime: p.endTime ?? "",
          breakAfter: p.breakAfter,
          sessionCount: p.sessionCount,
        }))
      );
    } else {
      setError(periodsRes.error ?? "Failed to load periods.");
    }
    if (blocksRes.ok) setBlocks(blocksRes.data);
    setLoading(false);
  }, [versionId]);

  useEffect(() => {
    if (open) {
      setBlockForm(null);
      setNotice(null);
      load();
    }
  }, [open, load]);

  const previewPeriods: Period[] = periods.map((p) => ({
    id: p.id ?? 0,
    label: p.label,
    sortOrder: p.sortOrder,
    startTime: p.startTime || null,
    endTime: p.endTime || null,
    breakAfter: p.breakAfter,
  }));
  const localErrors = periodSetErrors(previewPeriods);

  function setPeriod(index: number, patch: Partial<EditablePeriod>) {
    setPeriods((list) => list.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  // Only one period can carry the break, so setting it clears the others.
  function setBreakAt(index: number, value: boolean) {
    setPeriods((list) => list.map((p, i) => ({ ...p, breakAfter: value && i === index })));
  }

  function addPeriod() {
    setPeriods((list) => {
      const nextOrder = (list[list.length - 1]?.sortOrder ?? 0) + 1;
      return [...list, { label: "", sortOrder: nextOrder, startTime: "", endTime: "", breakAfter: false, sessionCount: 0 }];
    });
  }

  function removePeriod(index: number) {
    setPeriods((list) => list.filter((_, i) => i !== index));
  }

  /** Copy the shared standard set into this version as its own rows. */
  async function useCustomPeriods() {
    if (!versionId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/versions/${versionId}/periods`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // No ids: these become new rows owned by this version, leaving
          // the standard set itself untouched.
          periods: periods.map((p) => ({
            label: p.label,
            sortOrder: p.sortOrder,
            startTime: p.startTime || null,
            endTime: p.endTime || null,
            breakAfter: p.breakAfter,
          })),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setNotice("This version now has its own periods. Editing them no longer affects any other version.");
        await load();
        onChanged();
      } else {
        setError(json.error ?? "Failed to create custom periods.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function savePeriods() {
    if (!versionId) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/versions/${versionId}/periods`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periods: periods.map((p) => ({
            id: p.id,
            label: p.label,
            sortOrder: p.sortOrder,
            startTime: p.startTime || null,
            endTime: p.endTime || null,
            breakAfter: p.breakAfter,
          })),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setNotice("Periods saved.");
        await load();
        onChanged();
      } else {
        setError(json.error ?? "Failed to save periods.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveBlock() {
    if (!versionId || !blockForm) return;
    setBlockSaving(true);
    setError(null);
    try {
      const body = {
        day: blockForm.day,
        fromSlot: Number(blockForm.fromSlot),
        toSlot: Number(blockForm.toSlot),
        label: blockForm.label,
        subLabel: blockForm.subLabel.trim() || null,
        allBatches: blockForm.allBatches,
        batchIds: blockForm.allBatches ? [] : blockForm.batchIds,
      };
      const res = await fetch(
        blockForm.id === null
          ? `/api/admin/versions/${versionId}/special-blocks`
          : `/api/admin/versions/${versionId}/special-blocks/${blockForm.id}`,
        {
          method: blockForm.id === null ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json = await res.json();
      if (json.ok) {
        setNotice(blockForm.id === null ? "Block added." : "Block updated.");
        setBlockForm(null);
        await load();
        onChanged();
      } else {
        setError(json.error ?? "Failed to save the block.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBlockSaving(false);
    }
  }

  async function deleteBlock(blockId: number) {
    if (!versionId) return;
    if (!confirm("Delete this block?")) return;
    setBlockSaving(true);
    try {
      const res = await fetch(`/api/admin/versions/${versionId}/special-blocks/${blockId}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        setNotice("Block deleted.");
        await load();
        onChanged();
      } else {
        setError(json.error ?? "Failed to delete the block.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBlockSaving(false);
    }
  }

  function batchNames(ids: number[]): string {
    const names = ids.map((id) => batches.find((b) => b.id === id)?.name ?? `#${id}`);
    return names.length > 0 ? names.join(", ") : "—";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Periods &amp; blocks — {version?.name ?? ""}</DialogTitle>
          <DialogDescription>
            This version&apos;s period columns, where its break falls, and the non-class blocks drawn on its routine.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <Loading />
        ) : (
          <div className="space-y-6">
            <p className="text-xs font-semibold text-muted-foreground">
              {periodSummary(previewPeriods)}
            </p>

            {!isOwn && (
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                These are the <strong className="text-foreground">standard periods</strong>, used by every version
                without periods of its own — so they are read-only here. Edit them in Academic Data → Time Slots, or
                give this version its own copy to change freely.
              </div>
            )}

            {/* ---- Periods ------------------------------------------------ */}
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="font-heading text-sm font-semibold text-foreground">Periods</h3>
                {isOwn && (
                  <LinkButton type="button" onClick={addPeriod}>
                    <Plus className="size-3.5 inline" aria-hidden="true" /> Add period
                  </LinkButton>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 pr-2 font-semibold">#</th>
                      <th className="py-1.5 pr-2 font-semibold">Label</th>
                      <th className="py-1.5 pr-2 font-semibold">Start</th>
                      <th className="py-1.5 pr-2 font-semibold">End</th>
                      <th className="py-1.5 pr-2 font-semibold">Break after</th>
                      <th className="py-1.5 font-semibold" />
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((p, i) => (
                      <tr key={p.id ?? `new-${i}`} className="border-t border-border">
                        <td className="py-1.5 pr-2 w-14">
                          <input
                            type="number"
                            min={1}
                            disabled={!isOwn || p.sessionCount > 0}
                            value={p.sortOrder}
                            onChange={(e) => setPeriod(i, { sortOrder: Number(e.target.value) })}
                            className={`${inputClass} disabled:opacity-60`}
                            aria-label={`Period ${p.sortOrder} number`}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="text"
                            disabled={!isOwn}
                            value={p.label}
                            onChange={(e) => setPeriod(i, { label: e.target.value })}
                            placeholder="09:30 – 10:45 am"
                            className={`${inputClass} disabled:opacity-60`}
                            aria-label={`Period ${p.sortOrder} label`}
                          />
                          {p.sessionCount > 0 && (
                            <span className="block text-[10px] text-muted-foreground mt-0.5">
                              In use by {p.sessionCount} {p.sessionCount === 1 ? "class" : "classes"}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 pr-2 w-24">
                          <input
                            type="time"
                            disabled={!isOwn}
                            value={p.startTime}
                            onChange={(e) => setPeriod(i, { startTime: e.target.value })}
                            className={`${inputClass} disabled:opacity-60`}
                            aria-label={`Period ${p.sortOrder} start`}
                          />
                        </td>
                        <td className="py-1.5 pr-2 w-24">
                          <input
                            type="time"
                            disabled={!isOwn}
                            value={p.endTime}
                            onChange={(e) => setPeriod(i, { endTime: e.target.value })}
                            className={`${inputClass} disabled:opacity-60`}
                            aria-label={`Period ${p.sortOrder} end`}
                          />
                        </td>
                        <td className="py-1.5 pr-2 text-center w-24">
                          <input
                            type="checkbox"
                            disabled={!isOwn}
                            checked={p.breakAfter}
                            onChange={(e) => setBreakAt(i, e.target.checked)}
                            className="size-4 accent-[var(--primary)] disabled:opacity-60"
                            aria-label={`Break after period ${p.sortOrder}`}
                          />
                        </td>
                        <td className="py-1.5 text-right w-10">
                          {isOwn && (
                            <button
                              type="button"
                              onClick={() => removePeriod(i)}
                              disabled={p.sessionCount > 0}
                              title={p.sessionCount > 0 ? "In use by classes" : "Remove period"}
                              aria-label={`Remove period ${p.sortOrder}`}
                              className="p-1 rounded text-muted-foreground hover:text-cancelled disabled:opacity-30"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {isOwn && localErrors.length > 0 && (
                <ul className="mt-2 text-xs text-cancelled list-disc pl-5 space-y-0.5">
                  {localErrors.map((e) => <li key={e}>{e}</li>)}
                </ul>
              )}

              <div className="mt-3 flex justify-end gap-3">
                {isOwn ? (
                  <Button type="button" onClick={savePeriods} loading={saving} disabled={localErrors.length > 0}>
                    {saving ? "Saving…" : "Save periods"}
                  </Button>
                ) : (
                  <Button type="button" onClick={useCustomPeriods} loading={saving}>
                    {saving ? "Copying…" : "Use custom periods"}
                  </Button>
                )}
              </div>
            </div>

            {/* ---- Special blocks ----------------------------------------- */}
            <div className="border-t border-border pt-5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="font-heading text-sm font-semibold text-foreground">Special blocks</h3>
                <LinkButton type="button" onClick={() => setBlockForm(emptyBlockForm(periods))}>
                  <Plus className="size-3.5 inline" aria-hidden="true" /> Add block
                </LinkButton>
              </div>

              {blocks.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No blocks. A block is a band drawn across the routine that isn&apos;t a class — Club Activities, for example.
                </p>
              ) : (
                <ul className="space-y-2">
                  {blocks.map((b) => (
                    <li key={b.id} className="flex items-start justify-between gap-3 bg-muted/40 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {b.label} <span className="font-normal text-muted-foreground">· {b.day} · periods {b.fromSlot}–{b.toSlot}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {b.subLabel ? `${b.subLabel} · ` : ""}
                          {b.allBatches ? "All batches" : batchNames(b.batchIds)}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-3">
                        <LinkButton
                          type="button"
                          onClick={() =>
                            setBlockForm({
                              id: b.id,
                              day: b.day,
                              fromSlot: String(b.fromSlot),
                              toSlot: String(b.toSlot),
                              label: b.label,
                              subLabel: b.subLabel ?? "",
                              allBatches: b.allBatches,
                              batchIds: b.batchIds,
                            })
                          }
                        >
                          Edit
                        </LinkButton>
                        <LinkButton type="button" tone="danger" muted onClick={() => deleteBlock(b.id)}>
                          Delete
                        </LinkButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {blockForm && (
                <div className="mt-3 border border-border rounded-lg p-3 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Day
                      <select
                        value={blockForm.day}
                        onChange={(e) => setBlockForm((f) => f && { ...f, day: e.target.value })}
                        className={inputClass}
                      >
                        {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      From period
                      <select
                        value={blockForm.fromSlot}
                        onChange={(e) => setBlockForm((f) => f && { ...f, fromSlot: e.target.value })}
                        className={inputClass}
                      >
                        {periods.map((p) => <option key={p.sortOrder} value={p.sortOrder}>{p.sortOrder}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      To period
                      <select
                        value={blockForm.toSlot}
                        onChange={(e) => setBlockForm((f) => f && { ...f, toSlot: e.target.value })}
                        className={inputClass}
                      >
                        {periods.map((p) => <option key={p.sortOrder} value={p.sortOrder}>{p.sortOrder}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Label
                      <input
                        type="text"
                        value={blockForm.label}
                        onChange={(e) => setBlockForm((f) => f && { ...f, label: e.target.value })}
                        className={inputClass}
                      />
                    </label>
                  </div>

                  <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Sub-label <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
                    <input
                      type="text"
                      value={blockForm.subLabel}
                      onChange={(e) => setBlockForm((f) => f && { ...f, subLabel: e.target.value })}
                      placeholder="6th, 7th and 8th Semesters"
                      className={inputClass}
                    />
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={blockForm.allBatches}
                      onChange={(e) => setBlockForm((f) => f && { ...f, allBatches: e.target.checked })}
                      className="size-4 accent-[var(--primary)]"
                    />
                    All batches
                  </label>

                  {!blockForm.allBatches && (
                    <div className="flex flex-wrap gap-2">
                      {batches.map((b) => {
                        const selected = blockForm.batchIds.includes(b.id);
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() =>
                              setBlockForm((f) =>
                                f && {
                                  ...f,
                                  batchIds: selected ? f.batchIds.filter((x) => x !== b.id) : [...f.batchIds, b.id],
                                }
                              )
                            }
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-muted text-muted-foreground hover:bg-muted/70"
                            }`}
                          >
                            {b.name} — {b.semester}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-end gap-3">
                    <LinkButton type="button" tone="neutral" onClick={() => setBlockForm(null)}>
                      Cancel
                    </LinkButton>
                    <Button type="button" onClick={saveBlock} loading={blockSaving}>
                      {blockSaving ? "Saving…" : blockForm.id === null ? "Add block" : "Save block"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {error && <Message type="error">{error}</Message>}
            {notice && <Message type="success">{notice}</Message>}

            <div className="flex justify-end border-t border-border pt-4">
              <LinkButton type="button" tone="neutral" onClick={() => onOpenChange(false)}>
                Close
              </LinkButton>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
