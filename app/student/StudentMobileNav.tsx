"use client";

import { CalendarDays, LayoutGrid, RefreshCw, Bell, AlarmClock, LayoutDashboard } from "lucide-react";
import { MobileBottomNav } from "@/app/components/MobileBottomNav";

// Primary tabs stay at four so the bar doesn't crowd; "Full Routine"
// (Step 48) sits in the More sheet alongside Dashboard, and is also one
// tap away from My Routine via the scope tabs on the page itself.
const ITEMS = [
  { href: "/student/routine", label: "My Routine", icon: CalendarDays },
  { href: "/student/notices", label: "Notices", icon: Bell },
  { href: "/student/alarms", label: "Reminders", icon: AlarmClock },
  { href: "/student/rescheduled", label: "Rescheduled", icon: RefreshCw },
];

const MORE = [
  { href: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/full-routine", label: "Full Routine", icon: LayoutGrid },
];

export default function StudentMobileNav() {
  return <MobileBottomNav items={ITEMS} more={MORE} />;
}
