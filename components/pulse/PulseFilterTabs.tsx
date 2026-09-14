"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { TabPill, TabPillRow } from "@/components/ui/TabPill";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "decisions", label: "Decisions" },
  { key: "blockers", label: "Blockers" },
  { key: "unanswered", label: "Unanswered" },
] as const;

/**
 * Pulse feed filter pills. Surfaces the smart-order dimensions as explicit
 * filters. Writes `?filter=` which PulseFeed reads and applies client-side.
 */
export default function PulseFilterTabs() {
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get("filter") ?? "all";

  return (
    <TabPillRow>
      {FILTERS.map((f) => (
        <TabPill
          key={f.key}
          sleek
          active={active === f.key}
          onClick={() => router.push(f.key === "all" ? "/pulse" : `/pulse?filter=${f.key}`)}
        >
          {f.label}
        </TabPill>
      ))}
    </TabPillRow>
  );
}
