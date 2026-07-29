"use client";

import { useRouter } from "next/navigation";
import TierPill from "@/components/TierPill";
import { useTier } from "@/contexts/TierContext";

// Subtle tier pill near the bottom of the sidebar. Reads tier/trial state from
// the shared TierContext (no own fetch) and routes to /settings when clicked.
// Hidden while collapsed.
export default function SidebarTierBadge({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const { tier, isTrialing, hasFullAccess, daysLeftInTrial, isLoading } = useTier();

  if (collapsed || isLoading) return null;

  // A live trial shows as "trial", not "free". It grants everything a Member
  // gets, so labelling it "free" next to an upgrade prompt was the pill half of
  // the same bug that blocked trial writes server-side.
  const pillState = tier === "free" && isTrialing ? "trial" : tier;
  const showTrialCountdown = isTrialing && daysLeftInTrial !== null && daysLeftInTrial <= 3;
  const showUpgradeLink = !hasFullAccess;

  return (
    <div style={{ borderTop: "1px solid var(--border-default)" }}>
      <button
        type="button"
        onClick={() => router.push("/settings")}
        title="manage subscription"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px 4px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          width: "100%",
        }}
      >
        <span
          className="font-mono lowercase"
          style={{ fontSize: 10, color: "var(--text-muted)" }}
        >
          plan
        </span>
        <TierPill tier={pillState} />
      </button>

      {showTrialCountdown && (
        <p
          style={{
            fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            fontSize: 9,
            color: "#f59e0b",
            letterSpacing: "0.05em",
            margin: "0 0 8px 14px",
          }}
        >
          trial ends in {daysLeftInTrial}d
        </p>
      )}

      {showUpgradeLink && (
        <button
          type="button"
          onClick={() => router.push("/pricing")}
          style={{
            display: "block",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            padding: 0,
            margin: "0 0 8px 14px",
            fontFamily: "var(--font-jetbrains-mono, ui-monospace, monospace)",
            fontSize: 9,
            color: "#f59e0b",
            letterSpacing: "0.05em",
            textDecoration: "none",
          }}
        >
          upgrade →
        </button>
      )}
    </div>
  );
}
