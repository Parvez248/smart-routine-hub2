"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppHeaderBand } from "@/app/components/AppHeaderBand";
import TeacherMobileNav from "./TeacherMobileNav";

const LINKS = [
  { href: "/teacher/classes", label: "My Classes" },
  { href: "/teacher/routine", label: "Full Routine" },
  { href: "/teacher/rescheduled", label: "Rescheduled Classes" },
  { href: "/teacher/free-rooms", label: "Free Rooms" },
  { href: "/teacher/requests", label: "My Requests" },
  { href: "/teacher/notices", label: "Notices" },
  { href: "/teacher/change-password", label: "Change Password" },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-10 print:hidden">
        <AppHeaderBand roleLabel="Teacher" maxWidthClassName="max-w-5xl" />
        <div className="bg-surface border-b border-border">
          <div className="max-w-5xl mx-auto px-6 py-3 overflow-x-auto">
            <nav className="hidden sm:flex items-center gap-1 text-xs font-medium">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-2.5 py-1.5 rounded-full transition-colors whitespace-nowrap ${
                    pathname === link.href
                      ? "bg-primary text-primary-foreground"
                      : "text-slate hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 pb-24 sm:pb-8 space-y-8">{children}</main>

      <TeacherMobileNav />
    </div>
  );
}
