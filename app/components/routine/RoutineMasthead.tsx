import { PrintButton } from "./PrintPanel";

function formatEffectiveDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// A printed-document masthead, left-aligned. Reads the version name and
// effective date from the published version — never hard-coded — and doubles
// as the printed header (the filters/printed-date line only shows in print).
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

  return (
    <div className="flex items-start justify-between gap-4 flex-wrap border-b border-border pb-4">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          Hamdard University Bangladesh
        </p>
        <p className="text-lg font-medium text-foreground mt-0.5">Dept. of Computer Science &amp; Engineering</p>
        <h1 className="font-heading text-2xl font-semibold text-foreground mt-1.5 pb-1.5 border-b-2 border-primary inline-block">
          Class Routine
        </h1>
        <p className="hidden print:block text-xs text-muted-foreground mt-2 font-data">
          Filters: {filterSummary && filterSummary.length > 0 ? filterSummary : "None"} · Printed: {new Date().toLocaleString()}
        </p>
      </div>
      {(versionName || effective) && (
        <div className="print:hidden shrink-0 flex items-start gap-2">
          <div className="text-right">
            {versionName && <p className="text-sm font-semibold text-foreground font-data">{versionName}</p>}
            {effective && <p className="text-xs text-muted-foreground font-data mt-0.5">Effective from {effective}</p>}
          </div>
          <PrintButton compact />
        </div>
      )}
      {!versionName && !effective && (
        <div className="print:hidden shrink-0">
          <PrintButton compact />
        </div>
      )}
    </div>
  );
}
