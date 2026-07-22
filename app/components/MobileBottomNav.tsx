"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type BottomNavItem = { href: string; label: string; icon: LucideIcon };

// Fixed, safe-area-aware bottom bar for small screens (4–5 items max). Desktop
// keeps the existing top nav; this never shows there. No floating action button —
// a 5th "More" item opens a plain sheet for anything that doesn't fit.
export function MobileBottomNav({ items, more }: { items: BottomNavItem[]; more?: BottomNavItem[] }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const hasMore = Boolean(more && more.length > 0);
  const columns = items.length + (hasMore ? 1 : 0);

  return (
    <>
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-border print:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {items.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 border-t-2 transition-colors ${
                  active ? "border-primary text-primary" : "border-transparent text-slate"
                }`}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span className="text-[11px] font-medium">{item.label}</span>
              </Link>
            );
          })}
          {hasMore && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className="flex flex-col items-center justify-center gap-0.5 py-2 border-t-2 border-transparent text-slate"
            >
              <MoreHorizontal className="size-5" aria-hidden="true" />
              <span className="text-[11px] font-medium">More</span>
            </button>
          )}
        </div>
      </nav>

      {hasMore && moreOpen && (
        <div className="sm:hidden fixed inset-0 z-60 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="More navigation links">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMoreOpen(false)} />
          <div className="relative bg-card rounded-t-lg border-t border-border shadow-md" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground">More</span>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close">
                <X className="size-4 text-slate" />
              </button>
            </div>
            <div className="p-2">
              {more!.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-foreground hover:bg-muted"
                  >
                    <Icon className="size-4 text-slate" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
