import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { AuthPageShell, AuthMasthead } from "@/app/components/AuthPageShell";

export const metadata: Metadata = { title: "Sign In" };

const ROLES = [
  { href: "/login/admin", label: "Administration Login", accent: "bg-primary/10 text-primary" },
  { href: "/login/teacher", label: "Teacher Login", accent: "bg-moved/10 text-moved" },
  { href: "/login/student", label: "Student Login", accent: "bg-confirmed/10 text-confirmed" },
];

export default function LoginChooserPage() {
  return (
    <AuthPageShell>
        <Card>
          <AuthMasthead />
          <CardHeader title="Sign In" description="Choose how you'd like to sign in" accent />

          <div className="px-8 py-6 space-y-3">
            {ROLES.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="flex items-center justify-between gap-3 border border-border hover:border-primary/40 hover:bg-primary/5 rounded-lg px-4 py-3 text-sm font-semibold text-foreground transition-colors"
              >
                {r.label}
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${r.accent}`}>
                  {r.label.split(" ")[0]}
                </span>
              </Link>
            ))}
          </div>

          <p className="text-center text-xs text-slate pb-6">
            <Link href="/" className="text-slate hover:text-foreground">
              ← Back to homepage
            </Link>
          </p>
        </Card>
    </AuthPageShell>
  );
}
