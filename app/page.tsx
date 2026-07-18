import Link from "next/link";

const ROLES = [
  {
    href: "/login/admin",
    icon: "🛠️",
    title: "Administration",
    description: "Manage courses, rooms, routine versions, and approvals.",
    accent: "bg-indigo-50 text-indigo-600",
  },
  {
    href: "/login/teacher",
    icon: "🧑‍🏫",
    title: "Teacher",
    description: "View your classes and reschedule when needed.",
    accent: "bg-violet-50 text-violet-600",
  },
  {
    href: "/login/student",
    icon: "🎓",
    title: "Student",
    description: "View your routine, notices, and class reminders.",
    accent: "bg-sky-50 text-sky-600",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-16">
      <div className="w-full max-w-3xl text-center">
        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-3">
          Hamdard University Bangladesh &middot; Dept. of CSE
        </p>
        <h1 className="text-3xl font-bold text-gray-900">Routine Management System</h1>
        <p className="text-sm text-gray-500 mt-3 leading-relaxed max-w-lg mx-auto">
          A class routine system for the department — build, publish, and manage the academic
          schedule in one place.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
          {ROLES.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all p-6 text-left flex flex-col gap-2"
            >
              <span className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-xl ${r.accent}`}>
                {r.icon}
              </span>
              <span className="font-semibold text-gray-900 mt-1">{r.title}</span>
              <span className="text-xs text-gray-500 leading-relaxed">{r.description}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
