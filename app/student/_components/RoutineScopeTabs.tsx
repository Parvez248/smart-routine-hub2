"use client";

import Link from "next/link";
import { CalendarDays, LayoutGrid } from "lucide-react";

/**
 * The "My Routine" | "Full Routine" switcher shown at the top of both
 * student routine pages (Step 48). They're two real routes rather than one
 * page with internal state, so each view is linkable/bookmarkable and the
 * layout nav's `pathname ===` active check keeps working — but they're
 * styled as one segmented control so they read as tabs.
 */
const TABS = [
  { scope: "mine", href: "/student/routine", label: "My Routine", icon: CalendarDays },
  { scope: "full", href: "/student/full-routine", label: "Full Routine", icon: LayoutGrid },
] as const;

export function RoutineScopeTabs({ active }: { active: "mine" | "full" }) {
  return (
    <div
      className="print:hidden inline-flex items-center rounded-md border border-border p-0.5 bg-muted/40"
      role="tablist"
      aria-label="Routine scope"
    >
      {TABS.map((tab) => {
        const isActive = tab.scope === active;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-colors ${
              isActive ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
