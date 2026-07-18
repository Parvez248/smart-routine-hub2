import Link from "next/link";
import { Card, CardHeader } from "@/app/components/ui/Card";

const ROLES = [
  { href: "/login/admin", label: "Administration Login", accent: "bg-indigo-100 text-indigo-700" },
  { href: "/login/teacher", label: "Teacher Login", accent: "bg-violet-100 text-violet-700" },
  { href: "/login/student", label: "Student Login", accent: "bg-sky-100 text-sky-700" },
];

export default function LoginChooserPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader title="SmartRoutineHub" description="Choose how you'd like to sign in" accent />

          <div className="px-8 py-6 space-y-3">
            {ROLES.map((r) => (
              <Link
                key={r.href}
                href={r.href}
                className="flex items-center justify-between gap-3 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/40 rounded-lg px-4 py-3 text-sm font-semibold text-gray-700 transition-colors"
              >
                {r.label}
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${r.accent}`}>
                  {r.label.split(" ")[0]}
                </span>
              </Link>
            ))}
          </div>

          <p className="text-center text-xs text-gray-400 pb-6">
            <Link href="/" className="text-gray-400 hover:text-gray-600">
              ← Back to homepage
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
