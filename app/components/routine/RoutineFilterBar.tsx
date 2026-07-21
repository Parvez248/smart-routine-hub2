"use client";

import { useEffect, useRef, useState } from "react";
import type { useRoutineFilters, Option } from "./useRoutineFilters";

type FiltersState = ReturnType<typeof useRoutineFilters>;

const DAY_OPTIONS: Option[] = [
  { value: "Sat", label: "Sat" },
  { value: "Sun", label: "Sun" },
  { value: "Mon", label: "Mon" },
  { value: "Tues", label: "Tues" },
  { value: "Wed", label: "Wed" },
];

function ChevronIcon() {
  return (
    <svg className="h-3 w-3 text-gray-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
  );
}

function MultiSelectDropdown({
  label, options, selected, onToggle, disabled,
}: {
  label: string; options: Option[]; selected: string[]; onToggle: (v: string) => void; disabled?: boolean;
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

  const selectedLabels = options.filter((o) => selected.includes(o.value));
  const summary =
    selectedLabels.length === 0 ? `All ${label}` : selectedLabels.length === 1 ? selectedLabels[0].label : `${selectedLabels.length} selected`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`border rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
          disabled
            ? "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed"
            : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100"
        }`}
      >
        <span className="text-gray-400">{label}:</span> {summary}
        <ChevronIcon />
      </button>
      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-60 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
          {options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">No options</p>
          ) : (
            options.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => onToggle(opt.value)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                {opt.label}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TodayToggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
        active ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
      }`}
    >
      Today
    </button>
  );
}

function FilterControls({ state }: { state: FiltersState }) {
  const { filters, toggleMulti, options } = state;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <MultiSelectDropdown label="Batch" options={options.batches} selected={filters.batches} onToggle={(v) => toggleMulti("batches", v)} />
      <MultiSelectDropdown
        label="Day"
        options={DAY_OPTIONS}
        selected={filters.days}
        onToggle={(v) => toggleMulti("days", v)}
        disabled={filters.today}
      />
      <MultiSelectDropdown label="Teacher" options={options.teachers} selected={filters.teachers} onToggle={(v) => toggleMulti("teachers", v)} />
      <MultiSelectDropdown label="Room" options={options.rooms} selected={filters.rooms} onToggle={(v) => toggleMulti("rooms", v)} />
      <MultiSelectDropdown label="Course" options={options.courses} selected={filters.courses} onToggle={(v) => toggleMulti("courses", v)} />
      <MultiSelectDropdown label="Slot" options={options.timeSlots} selected={filters.timeSlots} onToggle={(v) => toggleMulti("timeSlots", v)} />
    </div>
  );
}

export function RoutineFilterBar({ state }: { state: FiltersState }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { filters, qInput, setQInput, toggleToday, clearAll, activeCount, chips } = state;

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

        <div className="hidden sm:block">
          <TodayToggle active={filters.today} onClick={toggleToday} />
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
        </div>
      </div>

      <div className="hidden sm:block">
        <FilterControls state={state} />
      </div>

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
            <TodayToggle active={filters.today} onClick={toggleToday} />
            <div className="flex flex-col gap-2">
              <FilterControls state={state} />
            </div>
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
