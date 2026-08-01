import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function StatCard({
  label, value, icon: Icon, color, href, subtext, loading = false,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  href?: string;
  subtext?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border px-5 py-4 flex items-center gap-3">
        <Skeleton className="size-10 rounded-lg shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-10" />
        </div>
      </div>
    );
  }

  const content = (
    <>
      <div
        className="shrink-0 size-10 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, var(--surface))` }}
      >
        <Icon className="size-5" style={{ color }} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium leading-tight">{label}</p>
        <p className="font-heading tabular text-2xl font-semibold text-foreground leading-tight mt-1">{value}</p>
        {subtext && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtext}</p>}
      </div>
    </>
  );

  const className = "bg-card rounded-lg border border-border px-5 py-4 flex items-center gap-3 h-full transition-colors";

  if (!href) return <div className={className}>{content}</div>;
  return (
    <Link href={href} className={`${className} hover:border-primary/40`}>
      {content}
    </Link>
  );
}
