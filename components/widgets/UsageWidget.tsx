"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TierPill from "@/components/TierPill";

type Feature = "cohort_posts" | "pulse_posts" | "replies" | "messages" | "vault_notes";

// Capped features shown in the widget (collab is excluded — it's a hard 0 lock
// surfaced elsewhere). Order is intentional.
const ROWS: { key: Feature; label: string }[] = [
  { key: "cohort_posts", label: "cohort posts" },
  { key: "pulse_posts", label: "pulse posts" },
  { key: "replies", label: "replies" },
  { key: "messages", label: "messages" },
  { key: "vault_notes", label: "vault notes" },
];

interface UsageData {
  tier: string;
  status: string;
  usage: Record<string, number>;
  limits: Record<string, number>;
}

// Bar fill color by fraction used.
function fillColor(used: number, limit: number): string {
  if (limit <= 0) return "#f85149";
  const pct = (used / limit) * 100;
  if (pct <= 50) return "#22c55e";
  if (pct <= 80) return "#f59e0b";
  return "#f85149";
}

export default function UsageWidget() {
  const router = useRouter();
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/usage");
        const json = (await res.json()) as UsageData;
        if (!cancelled) setData(json);
      } catch {
        // ignore — widget simply won't render
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Skeleton while fetching.
  if (loading) {
    return (
      <div
        style={{
          background: "#161b22",
          border: "1px solid #21262d",
          borderRadius: 4,
          padding: 16,
        }}
      >
        <div
          style={{
            height: 9,
            width: 80,
            background: "#21262d",
            borderRadius: 2,
            marginBottom: 16,
          }}
        />
        {ROWS.map((r) => (
          <div key={r.key} style={{ marginBottom: 12 }}>
            <div
              style={{
                height: 8,
                width: "40%",
                background: "#21262d",
                borderRadius: 2,
                marginBottom: 6,
              }}
            />
            <div style={{ height: 3, background: "#21262d", borderRadius: 2 }} />
          </div>
        ))}
      </div>
    );
  }

  // Only free tier sees this widget — and never during an active trial, when
  // caps don't apply.
  if (!data || data.tier !== "free" || data.status === "trialing") return null;

  // Show the upgrade CTA when any tracked feature is at 80%+ usage.
  const anyHigh = ROWS.some(({ key }) => {
    const limit = data.limits[key];
    const used = data.usage[key] || 0;
    return limit > 0 && used / limit >= 0.8;
  });

  return (
    <div
      style={{
        background: "#161b22",
        border: "1px solid #21262d",
        borderRadius: 4,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            fontSize: 9,
            color: "#484f58",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          this month
        </span>
        <TierPill tier="free" />
      </div>

      {ROWS.map(({ key, label }) => {
        const limit = data.limits[key] ?? 0;
        const used = data.usage[key] || 0;
        const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 100;
        return (
          <div key={key} style={{ marginBottom: 12 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 5,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
                  fontSize: 10,
                  color: "#6e7681",
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
                  fontSize: 10,
                  color: "#484f58",
                }}
              >
                {used} / {limit}
              </span>
            </div>
            <div
              style={{
                height: 3,
                background: "#21262d",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${pct}%`,
                  background: fillColor(used, limit),
                  borderRadius: 2,
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        );
      })}

      {anyHigh && data.tier === "free" && data.status !== "trialing" && (
        <button
          onClick={() => router.push("/pricing")}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            fontSize: 10,
            color: "#f59e0b",
            padding: 0,
            marginTop: 4,
          }}
        >
          upgrade for unlimited access →
        </button>
      )}
    </div>
  );
}
