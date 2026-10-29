"use client";

// One routine version's day structure, for the views that only read it
// (teacher and student). GET /api/periods with no versionId answers for the
// published version, which is the only one those views ever show — so they
// call this with no argument.
//
// The admin Schedule tab deliberately doesn't use this: it fetches the
// *selected* version's periods alongside its sessions, so both change in
// one render when the version picker changes.
import { useEffect, useState } from "react";
import type { Period, SpecialBlockView } from "@/lib/ui/periods";

export type PeriodsState = {
  periods: Period[];
  specialBlocks: SpecialBlockView[];
  loading: boolean;
};

export function usePeriods(versionId?: number | null): PeriodsState {
  const [state, setState] = useState<PeriodsState>({ periods: [], specialBlocks: [], loading: true });

  useEffect(() => {
    let cancelled = false;
    const query = versionId ? `?versionId=${versionId}` : "";
    fetch(`/api/periods${query}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.ok) {
          setState({ periods: json.data.periods, specialBlocks: json.data.specialBlocks, loading: false });
        } else {
          // The grid falls back to deriving its columns from the sessions
          // it was given, so a failure here degrades rather than blanks.
          setState({ periods: [], specialBlocks: [], loading: false });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ periods: [], specialBlocks: [], loading: false });
      });
    return () => { cancelled = true; };
  }, [versionId]);

  return state;
}
