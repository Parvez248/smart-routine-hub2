"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/routine", label: "Routine" },
  { href: "/admin/data", label: "Academic Data" },
  { href: "/admin/people", label: "People & Notices" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 text-xs font-medium whitespace-nowrap">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`px-2.5 py-1.5 rounded-full transition-colors ${
            pathname === link.href
              ? "bg-indigo-50 text-indigo-600"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
