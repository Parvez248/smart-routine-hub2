"use client";

import { useSession, signOut } from "next-auth/react";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import { APP_SUBTITLE } from "@/lib/config/app";

// The persistent app-identity header — a flat --band-1 band (no gradient) with
// a 1px accent rule along the bottom edge, per the "depth of seniority" spec.
export function AppHeaderBand({
  roleLabel,
  maxWidthClassName = "max-w-5xl",
}: {
  roleLabel: string;
  maxWidthClassName?: string;
}) {
  const { data: session } = useSession();
  const name = session?.user?.name || session?.user?.email || "—";

  return (
    <div className="on-band print:hidden bg-band-1 border-b border-primary">
      <div className={`${maxWidthClassName} mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap`}>
        <div className="min-w-0">
          <p className="font-heading text-white text-xl sm:text-[26px] font-semibold leading-tight truncate">{name}</p>
          <p className="text-white/80 text-[13px] mt-0.5">
            {roleLabel} · {APP_SUBTITLE}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <ThemeToggle onBand />
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs font-semibold text-white/70 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
