"use client";

import { AppHeaderBand } from "@/app/components/AppHeaderBand";
import AdminNav from "./AdminNav";
import AdminMobileNav from "./AdminMobileNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 print:hidden">
        <AppHeaderBand roleLabel="Administrator" maxWidthClassName="max-w-6xl" />
        <div className="bg-surface border-b border-border">
          <div className="max-w-6xl mx-auto px-6 py-3 overflow-x-auto">
            <AdminNav />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 pb-24 sm:pb-8 space-y-8">{children}</main>

      <AdminMobileNav />
    </div>
  );
}
