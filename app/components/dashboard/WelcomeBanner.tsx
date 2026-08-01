import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type WelcomeAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  tone?: "solid" | "translucent";
};

function ActionButton({ label, href, onClick, icon: Icon, tone = "translucent" }: WelcomeAction) {
  const className =
    tone === "solid"
      ? "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold bg-white text-[var(--primary)] hover:opacity-90 transition-opacity"
      : "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold bg-white/15 text-white border border-white/30 hover:bg-white/25 transition-colors";

  const content = (
    <>
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}
      {label}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

// The dashboard hero — green→cyan gradient (Step 35; the one deliberate
// exception to the app's "no gradients" rule, scoped to this component only),
// name + role/context line, and up to a few action buttons. `.on-band` keeps
// it print-safe like every other coloured surface in the app, even though
// this one isn't a routine "band".
export function WelcomeBanner({
  name,
  subtitle,
  actions,
}: {
  name: string;
  subtitle: string;
  actions?: WelcomeAction[];
}) {
  return (
    <div
      className="on-band print:hidden rounded-lg px-6 py-6 sm:py-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      style={{ background: "linear-gradient(135deg, var(--banner-from) 0%, var(--banner-to) 100%)" }}
    >
      <div className="min-w-0">
        <p className="text-white/75 text-xs font-semibold uppercase tracking-wide">Welcome back,</p>
        <h1 className="font-heading text-white text-2xl sm:text-3xl font-semibold mt-1 truncate">{name}</h1>
        <p className="text-white/80 text-sm mt-1">{subtitle}</p>
      </div>
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions.map((a) => (
            <ActionButton key={a.label} {...a} />
          ))}
        </div>
      )}
    </div>
  );
}
