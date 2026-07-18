"use client";

import { useEffect, useRef, useState } from "react";
import { nextOccurrenceOf } from "@/lib/services/timeslot";

type AlarmWithSession = {
  id: number;
  leadMinutes: number;
  isActive: boolean;
  session: {
    day: string;
    status: string;
    course: { code: string };
    room: { name: string };
    timeSlot: { label: string };
  } | null;
};

type Banner = { key: string; text: string };

const CHECK_INTERVAL_MS = 30 * 1000;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export default function ReminderEngine() {
  const [alarms, setAlarms] = useState<AlarmWithSession[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const firedRef = useRef<Set<string>>(new Set());

  async function loadAlarms() {
    try {
      const res = await fetch("/api/student/alarms");
      const json = await res.json();
      if (json.ok) setAlarms(json.data);
    } catch {
      // Reminder polling is best-effort; a transient failure just tries again next interval.
    }
  }

  useEffect(() => {
    loadAlarms();
    const refresh = setInterval(loadAlarms, REFRESH_INTERVAL_MS);
    return () => clearInterval(refresh);
  }, []);

  useEffect(() => {
    function check() {
      const now = new Date();
      for (const alarm of alarms) {
        if (!alarm.isActive || !alarm.session || alarm.session.status === "CANCELLED") continue;

        const occurrence = nextOccurrenceOf(alarm.session.day, alarm.session.timeSlot.label, now);
        if (!occurrence) continue;

        const reminderAt = new Date(occurrence.getTime() - alarm.leadMinutes * 60 * 1000);
        const key = `${alarm.id}-${occurrence.toISOString()}`;
        if (now >= reminderAt && now < occurrence && !firedRef.current.has(key)) {
          firedRef.current.add(key);
          const text = `${alarm.session.course.code} starts in ${alarm.leadMinutes} min · Room ${alarm.session.room.name}`;
          setBanners((b) => [...b, { key, text }]);

          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification("Upcoming class", { body: text });
            } catch {
              // Notification construction can throw in unsupported contexts; the on-screen banner already covers it.
            }
          }
        }
      }
    }

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [alarms]);

  function dismiss(key: string) {
    setBanners((b) => b.filter((x) => x.key !== key));
  }

  if (banners.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-xs">
      {banners.map((b) => (
        <div
          key={b.key}
          className="bg-indigo-600 text-white rounded-lg shadow-lg px-4 py-3 text-sm flex items-start gap-3"
        >
          <span className="text-base leading-none">🔔</span>
          <span className="flex-1">{b.text}</span>
          <button
            onClick={() => dismiss(b.key)}
            className="text-white/70 hover:text-white text-xs font-semibold"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
