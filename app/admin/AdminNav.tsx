"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/routine", label: "Routine" },
  { href: "/admin/versions", label: "Versions" },
  { href: "/admin/notices", label: "Notices" },
  { href: "/admin/courses", label: "Courses" },
  { href: "/admin/rooms", label: "Rooms" },
  { href: "/admin/teachers", label: "Teachers" },
  { href: "/admin/batches", label: "Batches" },
  { href: "/admin/timeslots", label: "Time Slots" },
  { href: "/admin/teacher-requests", label: "Teacher Requests" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 text-xs font-medium">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`px-2.5 py-1 rounded-full transition-colors ${
            pathname === link.href
              ? "bg-indigo-50 text-indigo-600"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          {link.label}
        </Link>
      ))}
      <span className="text-gray-200">·</span>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="px-2.5 py-1 text-gray-400 hover:text-gray-600 transition-colors"
      >
        Sign out
      </button>
    </nav>
  );
}
