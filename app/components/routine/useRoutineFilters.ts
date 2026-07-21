"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FilterableSession } from "./types";
import { dayNameForDate } from "@/lib/services/dates";

export type ClassTypeFilter = "ALL" | "THEORY" | "LAB";
export type StatusFilter = "ALL" | "ACTIVE" | "CANCELLED" | "RESCHEDULED";
export type ViewMode = "grid" | "list";

export type RoutineFiltersState = {
  q: string;
  yearBands: string[];
  batches: string[];
  days: string[];
  teachers: string[];
  rooms: string[];
  courses: string[];
  classType: ClassTypeFilter;
  timeSlots: string[];
  section: string; // "ALL" | "NONE" | an actual section value
  status: StatusFilter;
};

type MultiKey = "yearBands" | "batches" | "days" | "teachers" | "rooms" | "courses" | "timeSlots";
const MULTI_KEYS: MultiKey[] = ["yearBands", "batches", "days", "teachers", "rooms", "courses", "timeSlots"];
const PARAM_MAP: Record<MultiKey, string> = {
  yearBands: "year",
  batches: "batch",
  days: "day",
  teachers: "teacher",
  rooms: "room",
  courses: "course",
  timeSlots: "slot",
};

const DEFAULT_FILTERS: RoutineFiltersState = {
  q: "",
  yearBands: [],
  batches: [],
  days: [],
  teachers: [],
  rooms: [],
  courses: [],
  classType: "ALL",
  timeSlots: [],
  section: "ALL",
  status: "ALL",
};

export function yearBandOf(semester: string): string {
  const n = parseInt(semester, 10);
  if (!Number.isFinite(n) || n <= 0) return "Other";
  const band = Math.ceil(n / 2);
  const ordinals: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", 6: "6th" };
  return `${ordinals[band] ?? `${band}th`} Year`;
}

function encodeFilters(f: RoutineFiltersState): URLSearchParams {
  const params = new URLSearchParams();
  if (f.q.trim()) params.set("q", f.q.trim());
  for (const key of MULTI_KEYS) {
    const arr = f[key];
    if (arr.length) params.set(PARAM_MAP[key], arr.join(","));
  }
  if (f.classType !== "ALL") params.set("type", f.classType);
  if (f.section !== "ALL") params.set("section", f.section);
  if (f.status !== "ALL") params.set("status", f.status);
  return params;
}

function decodeFilters(params: URLSearchParams): RoutineFiltersState | null {
  if ([...params.keys()].filter((k) => k !== "view").length === 0) return null;
  const getList = (k: string) => params.get(k)?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  return {
    q: params.get("q") ?? "",
    yearBands: getList("year"),
    batches: getList("batch"),
    days: getList("day"),
    teachers: getList("teacher"),
    rooms: getList("room"),
    courses: getList("course"),
    classType: (params.get("type") as ClassTypeFilter) ?? "ALL",
    timeSlots: getList("slot"),
    section: params.get("section") ?? "ALL",
    status: (params.get("status") as StatusFilter) ?? "ALL",
  };
}

export function useRoutineFilters<T extends FilterableSession>(
  sessions: T[],
  opts: { storageKey: string; currentTeacherInitials?: string | null }
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFiltersState] = useState<RoutineFiltersState>(DEFAULT_FILTERS);
  const [view, setView] = useState<ViewMode>("grid");
  const [qInput, setQInput] = useState("");
  const initialized = useRef(false);

  // One-time init: URL wins if it carries any filters, else localStorage, else defaults.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const fromUrl = decodeFilters(searchParams);
    const viewParam = searchParams.get("view");

    if (fromUrl) {
      setFiltersState(fromUrl);
      setQInput(fromUrl.q);
      if (viewParam === "list" || viewParam === "grid") setView(viewParam);
      return;
    }

    try {
      const raw = localStorage.getItem(`routine-filters:${opts.storageKey}`);
      if (raw) {
        const saved = JSON.parse(raw) as { filters?: RoutineFiltersState; view?: ViewMode };
        if (saved.filters) {
          setFiltersState(saved.filters);
          setQInput(saved.filters.q ?? "");
        }
        if (saved.view === "grid" || saved.view === "list") setView(saved.view);
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

  // Mirror filters + view to the URL and localStorage.
  useEffect(() => {
    if (!initialized.current) return;
    const params = encodeFilters(filters);
    if (view !== "grid") params.set("view", view);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    try {
      localStorage.setItem(`routine-filters:${opts.storageKey}`, JSON.stringify({ filters, view }));
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, view, pathname, opts.storageKey]);

  const setFilter = useCallback(<K extends keyof RoutineFiltersState>(key: K, value: RoutineFiltersState[K]) => {
    setFiltersState((f) => ({ ...f, [key]: value }));
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

  const presets = useMemo(
    () => ({
      applyToday: () => {
        const d = dayNameForDate(new Date());
        setFiltersState((f) => ({ ...f, days: d ? [d] : [] }));
      },
      applyThisWeek: () => setFiltersState((f) => ({ ...f, days: [] })),
      applyLabsOnly: () => setFiltersState((f) => ({ ...f, classType: "LAB" })),
      applyMyClasses: () => {
        if (!opts.currentTeacherInitials) return;
        setFiltersState((f) => ({ ...f, teachers: [opts.currentTeacherInitials!] }));
      },
      applyRescheduledOnly: () => setFiltersState((f) => ({ ...f, status: "RESCHEDULED" })),
    }),
    [opts.currentTeacherInitials]
  );

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return sessions.filter((s) => {
      if (filters.status === "ACTIVE" && s.status !== "ACTIVE") return false;
      if (filters.status === "CANCELLED" && s.status !== "CANCELLED") return false;
      if (filters.status === "RESCHEDULED" && !s.movedTo) return false;
      if (filters.classType !== "ALL" && s.course.type !== filters.classType) return false;
      if (filters.days.length && !filters.days.includes(s.day)) return false;
      if (filters.batches.length && !filters.batches.includes(s.batch.name)) return false;
      if (filters.teachers.length && !filters.teachers.includes(s.teacher.initials)) return false;
      if (filters.rooms.length && !filters.rooms.includes(s.room.name)) return false;
      if (filters.courses.length && !filters.courses.includes(s.course.code)) return false;
      if (filters.timeSlots.length && !filters.timeSlots.includes(s.timeSlot.label)) return false;
      if (filters.yearBands.length && !filters.yearBands.includes(yearBandOf(s.batch.semester))) return false;
      if (filters.section === "NONE" && s.section) return false;
      if (filters.section !== "ALL" && filters.section !== "NONE" && s.section !== filters.section) return false;
      if (q) {
        const haystack = `${s.course.code} ${s.course.title} ${s.teacher.name} ${s.teacher.initials} ${s.room.name}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [sessions, filters]);

  const options = useMemo(() => {
    const uniq = (arr: string[]) => [...new Set(arr)].sort((a, b) => a.localeCompare(b));
    const slotBySortOrder = [...new Map(sessions.map((s) => [s.timeSlot.label, s.timeSlot.sortOrder])).entries()].sort(
      (a, b) => a[1] - b[1]
    );
    return {
      yearBands: uniq(sessions.map((s) => yearBandOf(s.batch.semester))),
      batches: uniq(sessions.map((s) => s.batch.name)),
      teachers: uniq(sessions.map((s) => s.teacher.initials)),
      rooms: uniq(sessions.map((s) => s.room.name)),
      courses: uniq(sessions.map((s) => s.course.code)),
      timeSlots: slotBySortOrder.map(([label]) => label),
      sections: uniq(sessions.map((s) => s.section).filter((v): v is string => Boolean(v))),
    };
  }, [sessions]);

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.q.trim()) n++;
    for (const key of MULTI_KEYS) n += filters[key].length;
    if (filters.classType !== "ALL") n++;
    if (filters.section !== "ALL") n++;
    if (filters.status !== "ALL") n++;
    return n;
  }, [filters]);

  const chips = useMemo(() => {
    const list: { key: string; label: string; onRemove: () => void }[] = [];
    if (filters.q.trim()) list.push({ key: "q", label: `Search: "${filters.q.trim()}"`, onRemove: () => clearFilter("q") });
    filters.yearBands.forEach((v) => list.push({ key: `year-${v}`, label: `Year: ${v}`, onRemove: () => toggleMulti("yearBands", v) }));
    filters.batches.forEach((v) => list.push({ key: `batch-${v}`, label: `Batch: ${v}`, onRemove: () => toggleMulti("batches", v) }));
    filters.days.forEach((v) => list.push({ key: `day-${v}`, label: `Day: ${v}`, onRemove: () => toggleMulti("days", v) }));
    filters.teachers.forEach((v) => list.push({ key: `teacher-${v}`, label: `Teacher: ${v}`, onRemove: () => toggleMulti("teachers", v) }));
    filters.rooms.forEach((v) => list.push({ key: `room-${v}`, label: `Room: ${v}`, onRemove: () => toggleMulti("rooms", v) }));
    filters.courses.forEach((v) => list.push({ key: `course-${v}`, label: `Course: ${v}`, onRemove: () => toggleMulti("courses", v) }));
    filters.timeSlots.forEach((v) => list.push({ key: `slot-${v}`, label: `Slot: ${v}`, onRemove: () => toggleMulti("timeSlots", v) }));
    if (filters.classType !== "ALL") {
      list.push({ key: "type", label: `Type: ${filters.classType === "LAB" ? "Lab" : "Theory"}`, onRemove: () => clearFilter("classType") });
    }
    if (filters.section !== "ALL") {
      list.push({ key: "section", label: `Section: ${filters.section === "NONE" ? "None" : filters.section}`, onRemove: () => clearFilter("section") });
    }
    if (filters.status !== "ALL") {
      list.push({
        key: "status",
        label: `Status: ${filters.status.charAt(0) + filters.status.slice(1).toLowerCase()}`,
        onRemove: () => clearFilter("status"),
      });
    }
    return list;
  }, [filters, clearFilter, toggleMulti]);

  const filteredStats = useMemo(
    () => ({
      cancelled: filtered.filter((s) => s.status === "CANCELLED").length,
      rescheduled: filtered.filter((s) => Boolean(s.movedTo)).length,
    }),
    [filtered]
  );

  return {
    filters,
    qInput,
    setQInput,
    setFilter,
    toggleMulti,
    clearFilter,
    clearAll,
    view,
    setView,
    filtered,
    filteredStats,
    totalCount: sessions.length,
    options,
    activeCount,
    chips,
    presets,
  };
}
