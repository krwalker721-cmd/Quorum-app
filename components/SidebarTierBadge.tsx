"use client";

import { useRouter } from "next/navigation";
import TierPill from "@/components/TierPill";
import { useTier } from "@/contexts/TierContext";
import ui from "@/components/ui/sleek.module.css";

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
        <span className={ui.sideMeta}>Plan</span>
        <TierPill sleek tier={pillState} />
      </button>

      {showTrialCountdown && (
        <p className={ui.sideMeta} style={{ color: "#f59e0b", margin: "0 0 8px 14px" }}>
          Trial ends in {daysLeftInTrial} {daysLeftInTrial === 1 ? "day" : "days"}
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
            fontSize: 11.5,
            color: "#f59e0b",
            textDecoration: "none",
          }}
        >
          Upgrade →
        </button>
      )}
    </div>
  );
}
