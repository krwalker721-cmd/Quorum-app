"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function SegmentedBar({ filled, total = 12 }: { filled: number; total?: number }) {
  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`seg${i < filled ? " on" : ""}`} />
      ))}
    </div>
  );
}

/**
 * cohort_fill — real member count of the current user's cohort(s), averaged
 * across all cohorts they belong to, out of a fixed cap. Updates live as people
 * join or leave via a cohort_members subscription.
 */
export default function CohortFillStat({
  cohortIds,
  initialFill,
  cohortMax = 12,
}: {
  cohortIds: string[];
  initialFill: number;
  cohortMax?: number;
}) {
  const [fill, setFill] = useState(initialFill);

  const recompute = useCallback(async () => {
    if (cohortIds.length === 0) {
      setFill(0);
      return;
    }
    const supabase = createClient();
    const { data } = await supabase
      .from("cohort_members")
      .select("cohort_id, user_id")
      .in("cohort_id", cohortIds);
    const perCohort = new Map<string, Set<string>>();
    for (const r of data ?? []) {
      if (!r.cohort_id || !r.user_id) continue;
      if (!perCohort.has(r.cohort_id)) perCohort.set(r.cohort_id, new Set());
      perCohort.get(r.cohort_id)!.add(r.user_id);
    }
    const sizes = cohortIds.map((id) => perCohort.get(id)?.size ?? 0);
    const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    setFill(Math.round(avg));
  }, [cohortIds]);

  useEffect(() => {
    if (cohortIds.length === 0) return;
    const supabase = createClient();
    const channel = supabase
      .channel("cohort_fill:stream")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cohort_members" },
        () => {
          recompute();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [recompute, cohortIds.length]);

  return (
    <div className="stat-item">
      <span className="stat-label font-mono lowercase">cohort_fill</span>
      <span className="stat-value font-mono">{`${fill}/${cohortMax}`}</span>
      <SegmentedBar filled={Math.min(fill, cohortMax)} total={cohortMax} />
    </div>
  );
}
