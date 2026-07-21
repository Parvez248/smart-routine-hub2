"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { formatDateOnly, today, parseDateOnly, isClassDay, isOnOrAfterToday } from "@/lib/services/dates";

type Room = { id: number; name: string; capacity: number };

export default function TeacherFreeRoomsPage() {
  const [date, setDate] = useState("");
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
    if (!date || !timeSlotId) return;

    const parsed = parseDateOnly(date);
    if (!parsed || !isOnOrAfterToday(parsed)) {
      setError("Please pick today or a future date.");
      setRooms(null);
      return;
    }
    if (!isClassDay(parsed)) {
      setError("That date has no classes (Thu/Fri) — pick a Sat–Wed date.");
      setRooms(null);
      return;
    }

    setLoading(true);
    setError(null);
    setRooms(null);
    try {
      const res = await fetch(`/api/teacher/free-rooms?date=${date}&timeSlotId=${timeSlotId}`);
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
      <PageHeader title="Free Room Finder" description="Pick a date and time slot to see which rooms are available." />

      <Card>
        <CardHeader title="Search" accent />
        <form onSubmit={handleSearch} className="p-6 flex flex-wrap items-end gap-4">
          <div className="w-44 flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</label>
            <input
              type="date"
              required
              min={formatDateOnly(today())}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-border bg-muted rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
            />
          </div>

          <div className="w-56 flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Time Slot</label>
            <select
              required
              value={timeSlotId}
              onChange={(e) => setTimeSlotId(e.target.value)}
              className="border border-border bg-muted rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
            >
              <option value="">Select slot</option>
              {timeSlots.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          <Button type="submit" loading={loading} className="px-5">
            {loading ? "Searching…" : "Find Free Rooms"}
          </Button>
        </form>

        {error && <p className="px-6 pb-4 text-sm text-cancelled">{error}</p>}

        {rooms && (
          <div className="px-6 pb-6">
            {rooms.length === 0 ? (
              <p className="text-sm text-slate">No rooms are free at this date &amp; time.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {rooms.map((r) => (
                  <span key={r.id} className="text-xs font-semibold font-data bg-confirmed/10 text-confirmed px-3 py-1.5 rounded-full">
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
