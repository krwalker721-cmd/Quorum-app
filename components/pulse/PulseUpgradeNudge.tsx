"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTier } from "@/contexts/TierContext";

// Persistent nudge shown below the pulse composer once a free-tier (non-trial)
// user has hit their monthly pulse-post cap. Explains what they're missing.
export default function PulseUpgradeNudge() {
  const router = useRouter();
  const { tier, status } = useTier();
  const [usage, setUsage] = useState<{ current: number; limit: number } | null>(null);

  useEffect(() => {
    if (tier !== "free" || status === "trialing") {
      setUsage(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/usage");
        const json = await res.json();
        if (!cancelled) {
          setUsage({
            current: json.usage?.pulse_posts ?? 0,
            limit: json.limits?.pulse_posts ?? 0,
          });
        }
      } catch {
        // ignore — nudge simply won't render
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tier, status]);

  if (tier !== "free" || status === "trialing") return null;
  // Show as soon as they've used at least one pulse post this month — with only
  // a 2-post cap, waiting until the cap leaves no room for early awareness.
  if (!usage || usage.limit <= 0 || usage.current < 1) return null;

  const pct = Math.min(100, Math.round((usage.current / usage.limit) * 100));

  return (
    <div
      style={{
        maxWidth: 680,
        background: "#161b22",
        border: "1px solid #21262d",
        borderTop: "2px solid #f59e0b",
        borderRadius: "4px 4px 0 0",
        padding: "12px 16px",
      }}
    >
      <p
        className="font-mono"
        style={{ fontSize: 10, color: "#484f58" }}
      >
        // {usage.current} of {usage.limit} pulse posts used this month
      </p>
      <div
        style={{
          height: 3,
          background: "#21262d",
          borderRadius: 2,
          marginTop: 6,
          overflow: "hidden",
        }}
      >
        <div style={{ height: "100%", width: `${pct}%`, background: "#f59e0b", borderRadius: 2 }} />
      </div>
      <button
        type="button"
        onClick={() => router.push("/pricing")}
        className="font-mono"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: 10,
          color: "#f59e0b",
          marginTop: 8,
          padding: 0,
        }}
      >
        upgrade to Member for unlimited posting →
      </button>
    </div>
  );
}
