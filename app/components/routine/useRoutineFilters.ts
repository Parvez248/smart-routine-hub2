"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FilterableSession } from "./types";
import { dayNameForDate } from "@/lib/services/dates";

export type Option = { value: string; label: string };

export type RoutineFiltersState = {
  q: string;
  today: boolean;
  batches: string[];
  days: string[];
  teachers: string[];
  rooms: string[];
  courses: string[];
  timeSlots: string[];
};

type MultiKey = "batches" | "days" | "teachers" | "rooms" | "courses" | "timeSlots";
const MULTI_KEYS: MultiKey[] = ["batches", "days", "teachers", "rooms", "courses", "timeSlots"];
const PARAM_MAP: Record<MultiKey, string> = {
  batches: "batch",
  days: "day",
  teachers: "teacher",
  rooms: "room",
  courses: "course",
  timeSlots: "slot",
};

const DEFAULT_FILTERS: RoutineFiltersState = {
  q: "",
  today: false,
  batches: [],
  days: [],
  teachers: [],
  rooms: [],
  courses: [],
  timeSlots: [],
};

function encodeFilters(f: RoutineFiltersState): URLSearchParams {
  const params = new URLSearchParams();
  if (f.q.trim()) params.set("q", f.q.trim());
  if (f.today) params.set("today", "1");
  for (const key of MULTI_KEYS) {
    const arr = f[key];
    if (arr.length) params.set(PARAM_MAP[key], arr.join(","));
  }
  return params;
}

function decodeFilters(params: URLSearchParams): RoutineFiltersState | null {
  if ([...params.keys()].length === 0) return null;
  const getList = (k: string) => params.get(k)?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  return {
    q: params.get("q") ?? "",
    today: params.get("today") === "1",
    batches: getList("batch"),
    days: getList("day"),
    teachers: getList("teacher"),
    rooms: getList("room"),
    courses: getList("course"),
    timeSlots: getList("slot"),
  };
}

export function useRoutineFilters<T extends FilterableSession>(sessions: T[], opts: { storageKey: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFiltersState] = useState<RoutineFiltersState>(DEFAULT_FILTERS);
  const [qInput, setQInput] = useState("");
  const initialized = useRef(false);

  // One-time init: URL wins if it carries any filters, else localStorage, else defaults.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const fromUrl = decodeFilters(searchParams);
    if (fromUrl) {
      setFiltersState(fromUrl);
      setQInput(fromUrl.q);
      return;
    }

    try {
      const raw = localStorage.getItem(`routine-filters:${opts.storageKey}`);
      if (raw) {
        const saved = JSON.parse(raw) as { filters?: RoutineFiltersState };
        if (saved.filters) {
          setFiltersState(saved.filters);
          setQInput(saved.filters.q ?? "");
        }
      }
    } catch {
      // ignore malformed storage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce the raw search input into filters.q.
  useEffect(() => {
    const t = setTimeout(() => {
      setFiltersState((f) => (f.q === qInput ? f : { ...f, q: qInput }));
    }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  // Mirror filters to the URL and localStorage.
  useEffect(() => {
    if (!initialized.current) return;
    const params = encodeFilters(filters);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    try {
      localStorage.setItem(`routine-filters:${opts.storageKey}`, JSON.stringify({ filters }));
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, pathname, opts.storageKey]);

  const setFilter = useCallback(<K extends keyof RoutineFiltersState>(key: K, value: RoutineFiltersState[K]) => {
    setFiltersState((f) => ({ ...f, [key]: value }));
  }, []);

  const toggleToday = useCallback(() => {
    setFiltersState((f) => ({ ...f, today: !f.today }));
  }, []);

  const toggleMulti = useCallback((key: MultiKey, value: string) => {
    setFiltersState((f) => {
      const arr = f[key];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...f, [key]: next };
    });
  }, []);

  const clearFilter = useCallback((key: keyof RoutineFiltersState) => {
    setFiltersState((f) => ({ ...f, [key]: DEFAULT_FILTERS[key] }));
    if (key === "q") setQInput("");
  }, []);

  const clearAll = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
    setQInput("");
  }, []);

  const todayName = useMemo(() => dayNameForDate(new Date()), []);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return sessions.filter((s) => {
      if (filters.today) {
        if (!todayName || s.day !== todayName) return false;
      } else if (filters.days.length && !filters.days.includes(s.day)) {
        return false;
      }
      if (filters.batches.length && !filters.batches.includes(s.batch.name)) return false;
      if (filters.teachers.length && !filters.teachers.includes(s.teacher.initials)) return false;
      if (filters.rooms.length && !filters.rooms.includes(s.room.name)) return false;
      if (filters.courses.length && !filters.courses.includes(s.course.code)) return false;
      if (filters.timeSlots.length && !filters.timeSlots.includes(s.timeSlot.label)) return false;
      if (q) {
        const haystack = `${s.course.code} ${s.course.title} ${s.teacher.name} ${s.teacher.initials} ${s.room.name}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [sessions, filters, todayName]);

  const options = useMemo(() => {
    const uniqOptions = (values: string[]): Option[] =>
      [...new Set(values)].sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v }));

    const teacherMap = new Map<string, string>();
    sessions.forEach((s) => teacherMap.set(s.teacher.initials, s.teacher.name));
    const teachers: Option[] = [...teacherMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([initials, name]) => ({ value: initials, label: `${initials} – ${name}` }));

    const courseMap = new Map<string, string>();
    sessions.forEach((s) => courseMap.set(s.course.code, s.course.title));
    const courses: Option[] = [...courseMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([code, title]) => ({ value: code, label: `${code} – ${title}` }));

    const slotBySortOrder = [...new Map(sessions.map((s) => [s.timeSlot.label, s.timeSlot.sortOrder])).entries()].sort(
      (a, b) => a[1] - b[1]
    );
    const timeSlots: Option[] = slotBySortOrder.map(([label]) => ({ value: label, label }));

    return {
      batches: uniqOptions(sessions.map((s) => s.batch.name)),
      teachers,
      rooms: uniqOptions(sessions.map((s) => s.room.name)),
      courses,
      timeSlots,
    };
  }, [sessions]);

  const optionLabel = useCallback(
    (key: "teachers" | "courses", value: string) => options[key].find((o) => o.value === value)?.label ?? value,
    [options]
  );

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.q.trim()) n++;
    if (filters.today) n++;
    n += filters.batches.length;
    if (!filters.today) n += filters.days.length;
    n += filters.teachers.length + filters.rooms.length + filters.courses.length + filters.timeSlots.length;
    return n;
  }, [filters]);

  const chips = useMemo(() => {
    const list: { key: string; label: string; onRemove: () => void }[] = [];
    if (filters.q.trim()) list.push({ key: "q", label: `Search: "${filters.q.trim()}"`, onRemove: () => clearFilter("q") });
    if (filters.today) list.push({ key: "today", label: "Today", onRemove: () => toggleToday() });
    filters.batches.forEach((v) => list.push({ key: `batch-${v}`, label: `Batch: ${v}`, onRemove: () => toggleMulti("batches", v) }));
    if (!filters.today) {
      filters.days.forEach((v) => list.push({ key: `day-${v}`, label: `Day: ${v}`, onRemove: () => toggleMulti("days", v) }));
    }
    filters.teachers.forEach((v) =>
      list.push({ key: `teacher-${v}`, label: `Teacher: ${optionLabel("teachers", v)}`, onRemove: () => toggleMulti("teachers", v) })
    );
    filters.rooms.forEach((v) => list.push({ key: `room-${v}`, label: `Room: ${v}`, onRemove: () => toggleMulti("rooms", v) }));
    filters.courses.forEach((v) =>
      list.push({ key: `course-${v}`, label: `Course: ${optionLabel("courses", v)}`, onRemove: () => toggleMulti("courses", v) })
    );
    filters.timeSlots.forEach((v) => list.push({ key: `slot-${v}`, label: `Slot: ${v}`, onRemove: () => toggleMulti("timeSlots", v) }));
    return list;
  }, [filters, clearFilter, toggleMulti, toggleToday, optionLabel]);

  return {
    filters,
    qInput,
    setQInput,
    setFilter,
    toggleToday,
    toggleMulti,
    clearFilter,
    clearAll,
    filtered,
    totalCount: sessions.length,
    options,
    activeCount,
    chips,
  };
}
