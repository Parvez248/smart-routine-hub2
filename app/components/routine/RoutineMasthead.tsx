"use client";

import { useEffect } from "react";
import { PrintButton } from "./PrintPanel";

function formatEffectiveDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// The routine grid is wide (a full week × every batch), so it needs a
// landscape page — but everything else that prints in this app (e.g. the
// teacher credentials slip) must stay on the portrait default in
// globals.css. A named `@page` + the `page` CSS property looked like the
// textbook way to scope that, but it doesn't hold up: verified via a real
// Chromium print-to-PDF export, the named page was silently ignored and it
// fell back to Letter portrait. What does work reliably is scoping by
// existence — this <style> only exists in the document while a routine page
// (the only place RoutineMasthead is rendered) is mounted, so it's the only
// page-size override in effect when printing from here.
function useLandscapePrintPage() {
  useEffect(() => {
    const style = document.createElement("style");
    style.media = "print";
    style.textContent = "@page { size: A4 landscape; margin: 12mm; }";
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
}

// A printed-document masthead. Reads the version name and effective date from
// the published version — never hard-coded. Screen layout (left-aligned,
// version/print button on the right) is unchanged from before Step 46; the
// print output is a separate, centered block below it (`hidden print:block`)
// so the version name and effective date — previously screen-only — actually
// reach the printed page, alongside the existing filters/printed-date line.
export function RoutineMasthead({
  versionName,
  effectiveDate,
  filterSummary,
}: {
  versionName?: string | null;
  effectiveDate?: string | null;
  filterSummary?: string;
}) {
  const effective = formatEffectiveDate(effectiveDate ?? null);
  useLandscapePrintPage();

  return (
    <div className="glass print:border-0 print:shadow-none print:bg-transparent print:px-0 rounded-lg px-6 py-5 flex items-start justify-between gap-4 flex-wrap">
      <div className="print:hidden">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          Hamdard University Bangladesh
        </p>
        <p className="text-lg font-medium text-foreground mt-0.5">Dept. of Computer Science &amp; Engineering</p>
        <h1 className="font-heading text-2xl font-semibold text-foreground mt-1.5 pb-1.5 border-b-2 border-primary inline-block">
          Class Routine
        </h1>
      </div>
      {(versionName || effective) && (
        <div className="print:hidden shrink-0 flex items-start gap-3">
          <div className="text-right">
            {versionName && <p className="text-sm font-semibold text-foreground font-data">{versionName}</p>}
            {effective && (
              <p className="inline-flex items-center mt-1 px-2.5 py-1 rounded-full text-xs text-muted-foreground font-data bg-muted/70">
                Effective from {effective}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <PrintButton />
            <p className="text-[10px] leading-tight text-muted-foreground text-right max-w-32">
              Use your browser&apos;s Print dialog → Save as PDF.
            </p>
          </div>
        </div>
      )}
      {!versionName && !effective && (
        <div className="print:hidden shrink-0 flex flex-col items-end gap-1">
          <PrintButton />
          <p className="text-[10px] leading-tight text-muted-foreground text-right max-w-32">
            Use your browser&apos;s Print dialog → Save as PDF.
          </p>
        </div>
      )}

      {/* Print-only masthead — centered, first page, university/department/
          title + version + effective date + active filters + printed date. */}
      <div className="hidden print:block w-full text-center">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          Hamdard University Bangladesh
        </p>
        <p className="text-base font-medium text-foreground mt-0.5">Dept. of Computer Science &amp; Engineering</p>
        <h1 className="text-xl font-semibold text-foreground mt-1">Class Routine</h1>
        {(versionName || effective) && (
          <p className="text-sm text-foreground mt-1 font-data">
            {versionName}
            {versionName && effective ? " — " : ""}
            {effective ? `Effective from ${effective}` : ""}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1.5 font-data">
          Filters: {filterSummary && filterSummary.length > 0 ? filterSummary : "None"} · Printed: {new Date().toLocaleString()}
        </p>
      </div>
    </div>
  );
}
