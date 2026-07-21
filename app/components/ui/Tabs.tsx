"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

export type TabItem = { key: string; label: string; badge?: number };

export function Tabs({
  tabs,
  activeKey,
  paramName = "tab",
}: {
  tabs: TabItem[];
  activeKey: string;
  paramName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selectTab(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="overflow-x-auto">
      <nav className="flex items-center gap-1 border-b border-border min-w-max">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => selectTab(t.key)}
            aria-current={activeKey === t.key ? "page" : undefined}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px ${
              activeKey === t.key
                ? "text-primary [border-image:linear-gradient(135deg,var(--brand-from),var(--brand-to))_1] print:border-primary print:[border-image:none]"
                : "border-transparent text-slate hover:text-foreground"
            }`}
          >
            {t.label}
            {typeof t.badge === "number" && t.badge > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-primary/10 text-primary align-middle">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
