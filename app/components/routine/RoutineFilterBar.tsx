"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { useRoutineFilters, ClassTypeFilter, StatusFilter } from "./useRoutineFilters";

type FiltersState = ReturnType<typeof useRoutineFilters>;

function ChevronIcon() {
  return (
    <svg className="h-3 w-3 text-gray-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
  );
}

function MultiSelectDropdown({
  label, options, selected, onToggle,
}: {
  label: string; options: string[]; selected: string[]; onToggle: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const summary = selected.length === 0 ? `All ${label}` : selected.length === 1 ? selected[0] : `${selected.length} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 flex items-center gap-1.5 hover:bg-gray-100 transition-colors whitespace-nowrap"
      >
        <span className="text-gray-400">{label}:</span> {summary}
        <ChevronIcon />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-56 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">No options</p>
          ) : (
            options.map((opt) => (
              <label key={opt} className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => onToggle(opt)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                {opt}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Segmented<T extends string>({
  value, options, onChange,
}: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
            value === o.value ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function PresetButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-semibold bg-white border border-gray-200 text-gray-600 px-2.5 py-1.5 rounded-full hover:border-indigo-300 hover:text-indigo-600 transition-colors whitespace-nowrap"
    >
      {children}
    </button>
  );
}

export function RoutineFilterBar({
  state,
  showBatchFilter = true,
  showMyClassesPreset = false,
  freeRoomsHref,
}: {
  state: FiltersState;
  showBatchFilter?: boolean;
  showMyClassesPreset?: boolean;
  freeRoomsHref?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { filters, qInput, setQInput, setFilter, toggleMulti, clearAll, view, setView, options, activeCount, chips, presets } = state;

  const FilterControls = (
    <div className="flex flex-wrap items-center gap-2">
      <MultiSelectDropdown label="Year" options={options.yearBands} selected={filters.yearBands} onToggle={(v) => toggleMulti("yearBands", v)} />
      {showBatchFilter && (
        <MultiSelectDropdown label="Batch" options={options.batches} selected={filters.batches} onToggle={(v) => toggleMulti("batches", v)} />
      )}
      <MultiSelectDropdown label="Day" options={["Sat", "Sun", "Mon", "Tues", "Wed"]} selected={filters.days} onToggle={(v) => toggleMulti("days", v)} />
      <MultiSelectDropdown label="Teacher" options={options.teachers} selected={filters.teachers} onToggle={(v) => toggleMulti("teachers", v)} />
      <MultiSelectDropdown label="Room" options={options.rooms} selected={filters.rooms} onToggle={(v) => toggleMulti("rooms", v)} />
      <MultiSelectDropdown label="Course" options={options.courses} selected={filters.courses} onToggle={(v) => toggleMulti("courses", v)} />
      <MultiSelectDropdown label="Slot" options={options.timeSlots} selected={filters.timeSlots} onToggle={(v) => toggleMulti("timeSlots", v)} />

      <select
        value={filters.section}
        onChange={(e) => setFilter("section", e.target.value)}
        className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="ALL">All Sections</option>
        <option value="NONE">No section</option>
        {options.sections.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <Segmented<ClassTypeFilter>
        value={filters.classType}
        onChange={(v) => setFilter("classType", v)}
        options={[
          { value: "ALL", label: "All" },
          { value: "THEORY", label: "Theory" },
          { value: "LAB", label: "Lab" },
        ]}
      />

      <Segmented<StatusFilter>
        value={filters.status}
        onChange={(v) => setFilter("status", v)}
        options={[
          { value: "ALL", label: "All" },
          { value: "ACTIVE", label: "Active" },
          { value: "CANCELLED", label: "Cancelled" },
          { value: "RESCHEDULED", label: "Rescheduled" },
        ]}
      />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search course, teacher, room…"
            className="w-full border border-gray-200 bg-gray-50 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
          <svg className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
        </div>

        <div className="hidden sm:flex flex-wrap items-center gap-2">
          <PresetButton onClick={presets.applyToday}>Today</PresetButton>
          <PresetButton onClick={presets.applyThisWeek}>This week</PresetButton>
          <PresetButton onClick={presets.applyLabsOnly}>Labs only</PresetButton>
          {showMyClassesPreset && <PresetButton onClick={presets.applyMyClasses}>My classes</PresetButton>}
          <PresetButton onClick={presets.applyRescheduledOnly}>Rescheduled</PresetButton>
          {freeRoomsHref && (
            <Link href={freeRoomsHref} className="text-xs font-semibold bg-white border border-gray-200 text-gray-600 px-2.5 py-1.5 rounded-full hover:border-indigo-300 hover:text-indigo-600 transition-colors whitespace-nowrap">
              Free rooms now →
            </Link>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="sm:hidden relative text-xs font-semibold bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          >
            Filters
            {activeCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold bg-indigo-600 text-white align-middle">
                {activeCount}
              </span>
            )}
          </button>

          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${view === "grid" ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-700"}`}
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${view === "list" ? "bg-indigo-600 text-white" : "text-gray-500 hover:text-gray-700"}`}
            >
              List
            </button>
          </div>
        </div>
      </div>

      <div className="hidden sm:block">{FilterControls}</div>

      {mobileOpen && (
        <div className="sm:hidden fixed inset-0 z-30 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="relative bg-white rounded-t-2xl shadow-xl max-h-[80vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Filters</h3>
              <button type="button" onClick={() => setMobileOpen(false)} className="text-xs font-semibold text-indigo-600">
                Done
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PresetButton onClick={presets.applyToday}>Today</PresetButton>
              <PresetButton onClick={presets.applyThisWeek}>This week</PresetButton>
              <PresetButton onClick={presets.applyLabsOnly}>Labs only</PresetButton>
              {showMyClassesPreset && <PresetButton onClick={presets.applyMyClasses}>My classes</PresetButton>}
              <PresetButton onClick={presets.applyRescheduledOnly}>Rescheduled</PresetButton>
            </div>
            <div className="flex flex-col gap-2">{FilterControls}</div>
            {activeCount > 0 && (
              <button type="button" onClick={clearAll} className="text-xs font-semibold text-red-500 hover:text-red-600">
                Clear all filters
              </button>
            )}
          </div>
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.onRemove}
              className="inline-flex items-center gap-1 text-[11px] font-semibold bg-indigo-50 text-indigo-700 pl-2.5 pr-1.5 py-1 rounded-full hover:bg-indigo-100 transition-colors"
            >
              {c.label}
              <span className="text-indigo-400">×</span>
            </button>
          ))}
          <button type="button" onClick={clearAll} className="text-[11px] font-semibold text-gray-400 hover:text-red-500 px-1.5 py-1">
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
