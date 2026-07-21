"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import AdminNav from "./AdminNav";
import { ThemeToggle } from "@/app/components/ThemeToggle";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-border sticky top-0 z-10 print:hidden">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/admin/dashboard" className="text-lg font-bold text-foreground shrink-0">
            SmartRoutineHub
          </Link>
          <div className="flex items-center gap-4 shrink-0">
            {session?.user?.email && (
              <span className="text-xs text-slate hidden sm:inline">{session.user.email}</span>
            )}
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-xs font-semibold text-slate hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 pb-3 overflow-x-auto">
          <AdminNav />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">{children}</main>
    </div>
  );
}
