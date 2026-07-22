"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    <svg className="h-3 w-3 text-slate shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-slate" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
    </svg>
  );
}

function XIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// Portalled (via DropdownMenu) so the panel is never clipped by an ancestor's
// overflow-hidden, and flips above the trigger automatically near the bottom
// of the viewport. Checkbox items stay open on select (closeOnClick defaults
// to false), so multi-select behaves exactly as before.
function MultiSelectDropdown({
  label, options, selected, onToggle, disabled, searchable = false,
}: {
  label: string; options: Option[]; selected: string[]; onToggle: (v: string) => void; disabled?: boolean; searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedLabels = options.filter((o) => selected.includes(o.value));
  const summary =
    selectedLabels.length === 0 ? `All ${label}` : selectedLabels.length === 1 ? selectedLabels[0].label : `${selectedLabels.length} selected`;

  const visibleOptions =
    searchable && query.trim()
      ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
      : options;

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
        } else if (searchable) {
          // The menu auto-focuses its first item on open; steal focus back to
          // the search box on the next frame so typing works immediately.
          requestAnimationFrame(() => searchRef.current?.focus());
        }
      }}
    >
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={`Filter by ${label}`}
        className={`h-8 border rounded-lg px-3 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
          disabled
            ? "border-border/60 bg-muted/40 text-muted-foreground/50 cursor-not-allowed"
            : "border-border bg-card text-foreground hover:bg-muted/50"
        }`}
      >
        <span className="text-slate font-normal">{label}:</span> {summary}
        <ChevronIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        collisionPadding={8}
        className="max-sm:w-(--anchor-width) w-64 max-w-[calc(100vw-2rem)] p-0"
      >
        {searchable && (
          <div className="p-1.5 border-b border-border sticky top-0 bg-popover">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Escape") e.stopPropagation();
              }}
              placeholder={`Search ${label.toLowerCase()}…`}
              className="w-full h-7 px-2 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}
        <div className="max-h-[320px] overflow-y-auto py-1">
          {visibleOptions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No options</p>
          ) : (
            visibleOptions.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={selected.includes(opt.value)}
                onCheckedChange={() => onToggle(opt.value)}
                className="text-xs"
              >
                {opt.label}
              </DropdownMenuCheckboxItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TodayToggle({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-8 text-xs font-semibold px-3 rounded-full border transition-colors whitespace-nowrap ${
        active ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border text-foreground hover:border-primary/40 hover:text-primary"
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
      <MultiSelectDropdown label="Teacher" options={options.teachers} selected={filters.teachers} onToggle={(v) => toggleMulti("teachers", v)} searchable />
      <MultiSelectDropdown label="Room" options={options.rooms} selected={filters.rooms} onToggle={(v) => toggleMulti("rooms", v)} />
      <MultiSelectDropdown label="Course" options={options.courses} selected={filters.courses} onToggle={(v) => toggleMulti("courses", v)} searchable />
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
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <SearchIcon />
          </span>
          <Input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search course, teacher, room…"
            className="h-8 pl-8 pr-7 text-xs bg-card"
          />
          {qInput && (
            <button
              type="button"
              onClick={() => setQInput("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate hover:text-foreground"
              aria-label="Clear search"
            >
              <XIcon />
            </button>
          )}
        </div>

        <div className="hidden sm:block">
          <TodayToggle active={filters.today} onClick={toggleToday} />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="sm:hidden relative h-8 text-xs font-semibold bg-card border border-border text-foreground px-3 rounded-full hover:border-primary/40 hover:text-primary transition-colors"
          >
            Filters
            {activeCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold bg-primary text-primary-foreground align-middle font-data">
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
        <div className="sm:hidden fixed inset-0 z-60 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="relative bg-card rounded-t-lg shadow-lg max-h-[80vh] overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Filters
                {activeCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-primary text-primary-foreground align-middle font-data">
                    {activeCount}
                  </span>
                )}
              </h3>
              <button type="button" onClick={() => setMobileOpen(false)} className="text-xs font-semibold text-primary">
                Done
              </button>
            </div>
            <TodayToggle active={filters.today} onClick={toggleToday} />
            <div className="flex flex-col gap-2">
              <FilterControls state={state} />
            </div>
            {activeCount > 0 && (
              <button type="button" onClick={clearAll} className="text-xs font-semibold text-cancelled hover:opacity-80">
                Clear all filters
              </button>
            )}
          </div>
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <Badge
              key={c.key}
              variant="outline"
              role="button"
              tabIndex={0}
              aria-label={`Remove filter: ${c.label}`}
              className="cursor-pointer gap-1 pl-2.5 pr-1.5 bg-transparent border-primary/50 text-primary hover:bg-primary/5 focus-visible:outline-none"
              onClick={c.onRemove}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  c.onRemove();
                }
              }}
            >
              {c.label}
              <XIcon className="h-2.5 w-2.5" />
            </Badge>
          ))}
          <button type="button" onClick={clearAll} className="text-[11px] font-semibold text-muted-foreground hover:text-cancelled px-1.5 py-1">
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
