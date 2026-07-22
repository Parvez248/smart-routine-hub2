"use client";

import { LayoutDashboard, CalendarDays, BookOpen, Users } from "lucide-react";
import { MobileBottomNav } from "@/app/components/MobileBottomNav";

const ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/routine", label: "Routine", icon: CalendarDays },
  { href: "/admin/data", label: "Data", icon: BookOpen },
  { href: "/admin/people", label: "People", icon: Users },
];

export default function AdminMobileNav() {
  return <MobileBottomNav items={ITEMS} />;
}
