import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg text-center">
        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-3">
          Hamdard University Bangladesh &middot; Dept. of CSE
        </p>
        <h1 className="text-3xl font-bold text-gray-900">Routine Management System</h1>
        <p className="text-sm text-gray-500 mt-3 leading-relaxed">
          A class routine system for the department — build, publish, and manage the academic
          schedule in one place.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <Link
            href="/login"
            className="w-full sm:w-auto inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors shadow-sm"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            Register as teacher
          </Link>
          <Link
            href="/register-student"
            className="w-full sm:w-auto inline-flex items-center justify-center bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            Register as student
          </Link>
        </div>
      </div>
    </div>
  );
}
