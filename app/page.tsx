import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, APP_SUBTITLE } from "@/lib/config/app";

export const metadata: Metadata = { title: "Home" };

const ROLES = [
  {
    href: "/login/admin",
    icon: "🛠️",
    title: "Administration",
    description: "Manage courses, rooms, routine versions, and approvals.",
    accent: "bg-band-1/10 text-band-1",
  },
  {
    href: "/login/teacher",
    icon: "🧑‍🏫",
    title: "Teacher",
    description: "View your classes and reschedule when needed.",
    accent: "bg-band-2/10 text-band-2",
  },
  {
    href: "/login/student",
    icon: "🎓",
    title: "Student",
    description: "View your routine, notices, and class reminders.",
    accent: "bg-band-3/10 text-band-3",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-canvas px-4 py-16">
      <div className="w-full max-w-3xl text-center">
        <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">
          {APP_SUBTITLE}
        </p>
        <h1 className="font-heading text-3xl font-bold text-foreground">{APP_NAME}</h1>
        <p className="text-sm text-slate mt-3 leading-relaxed max-w-lg mx-auto">
          A class routine system for the department — build, publish, and manage the academic
          schedule in one place.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
          {ROLES.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="bg-card rounded-lg border border-border hover:border-primary/40 transition-colors p-6 text-left flex flex-col gap-2"
            >
              <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-xl ${r.accent}`}>
                {r.icon}
              </span>
              <span className="font-semibold text-foreground mt-1">{r.title}</span>
              <span className="text-xs text-slate leading-relaxed">{r.description}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
