"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import ReminderEngine from "./ReminderEngine";
import { ThemeToggle } from "@/app/components/ThemeToggle";

const LINKS = [
  { href: "/student/routine", label: "My Routine" },
  { href: "/student/rescheduled", label: "Rescheduled Classes" },
  { href: "/student/notices", label: "Notices" },
  { href: "/student/alarms", label: "Reminders" },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-surface border-b border-border sticky top-0 z-10 print:hidden">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/student/routine" className="text-lg font-bold text-foreground shrink-0">
            SmartRoutineHub
          </Link>
          <div className="flex items-center gap-4 shrink-0">
            {session?.user && (
              <span className="text-xs text-slate hidden sm:inline">
                {session.user.name ?? session.user.email}
              </span>
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
        <div className="max-w-5xl mx-auto px-6 pb-3">
          <nav className="flex items-center gap-1 text-xs font-medium">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2.5 py-1.5 rounded-full transition-colors ${
                  pathname === link.href
                    ? "bg-primary/10 text-primary"
                    : "text-slate hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">{children}</main>
      <ReminderEngine />
    </div>
  );
}
