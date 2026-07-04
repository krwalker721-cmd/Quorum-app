"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { TabPill, TabPillRow } from "@/components/ui/TabPill";

const FILTERS = [
  { key: "all", label: "all" },
  { key: "decisions", label: "decisions" },
  { key: "blockers", label: "blockers" },
  { key: "unanswered", label: "unanswered" },
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
          active={active === f.key}
          radius={14}
          onClick={() => router.push(f.key === "all" ? "/pulse" : `/pulse?filter=${f.key}`)}
        >
          {f.label}
        </TabPill>
      ))}
    </TabPillRow>
  );
}
