"use client";

import { CalendarDays, RefreshCw, Bell, AlarmClock } from "lucide-react";
import { MobileBottomNav } from "@/app/components/MobileBottomNav";

const ITEMS = [
  { href: "/student/routine", label: "Routine", icon: CalendarDays },
  { href: "/student/rescheduled", label: "Rescheduled", icon: RefreshCw },
  { href: "/student/notices", label: "Notices", icon: Bell },
  { href: "/student/alarms", label: "Reminders", icon: AlarmClock },
];

export default function StudentMobileNav() {
  return <MobileBottomNav items={ITEMS} />;
}
