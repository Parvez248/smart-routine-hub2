"use client";

import { LayoutDashboard, GraduationCap, CalendarDays, Inbox, Bell, RefreshCw, DoorOpen, KeyRound } from "lucide-react";
import { MobileBottomNav } from "@/app/components/MobileBottomNav";

const ITEMS = [
  { href: "/teacher/classes", label: "Classes", icon: GraduationCap },
  { href: "/teacher/routine", label: "Routine", icon: CalendarDays },
  { href: "/teacher/requests", label: "Requests", icon: Inbox },
  { href: "/teacher/notices", label: "Notices", icon: Bell },
];

const MORE = [
  { href: "/teacher/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/teacher/rescheduled", label: "Rescheduled Classes", icon: RefreshCw },
  { href: "/teacher/free-rooms", label: "Free Rooms", icon: DoorOpen },
  { href: "/teacher/change-password", label: "Change Password", icon: KeyRound },
];

export default function TeacherMobileNav() {
  return <MobileBottomNav items={ITEMS} more={MORE} />;
}
