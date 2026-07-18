"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import AdminNav from "./AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/admin/dashboard" className="text-lg font-bold text-gray-900 shrink-0">
            SmartRoutineHub
          </Link>
          <div className="flex items-center gap-4 shrink-0">
            {session?.user?.email && (
              <span className="text-xs text-gray-400 hidden sm:inline">{session.user.email}</span>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
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
