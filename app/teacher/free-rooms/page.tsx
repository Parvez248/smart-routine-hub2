"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";

type Room = { id: number; name: string; capacity: number };

const DAYS = ["Sat", "Sun", "Mon", "Tues", "Wed"];

export default function TeacherFreeRoomsPage() {
  const [day, setDay] = useState("");
  const [timeSlotId, setTimeSlotId] = useState("");
  const [timeSlots, setTimeSlots] = useState<{ id: number; label: string }[]>([]);
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/reference")
      .then((res) => res.json())
      .then((json) => { if (json.ok) setTimeSlots(json.data.timeSlots); });
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!day || !timeSlotId) return;
    setLoading(true);
    setError(null);
    setRooms(null);
    try {
      const res = await fetch(`/api/teacher/free-rooms?day=${encodeURIComponent(day)}&timeSlotId=${timeSlotId}`);
      const json = await res.json();
      if (json.ok) {
        setRooms(json.data);
      } else {
        setError(json.error ?? "Failed to load free rooms.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title="Free Room Finder" description="Pick a day and time slot to see which rooms are available." />

      <Card>
        <CardHeader title="Search" accent />
        <form onSubmit={handleSearch} className="p-6 flex flex-wrap items-end gap-4">
          <div className="w-40 flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Day</label>
            <select
              required
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            >
              <option value="">Select day</option>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="w-56 flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Time Slot</label>
            <select
              required
              value={timeSlotId}
              onChange={(e) => setTimeSlotId(e.target.value)}
              className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            >
              <option value="">Select slot</option>
              {timeSlots.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          <Button type="submit" loading={loading} className="px-5">
            {loading ? "Searching…" : "Find Free Rooms"}
          </Button>
        </form>

        {error && <p className="px-6 pb-4 text-sm text-red-600">{error}</p>}

        {rooms && (
          <div className="px-6 pb-6">
            {rooms.length === 0 ? (
              <p className="text-sm text-gray-400">No rooms are free at this day &amp; time.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {rooms.map((r) => (
                  <span key={r.id} className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full">
                    Room {r.name} (cap {r.capacity})
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>
    </>
  );
}
