"use client";

import { useRouter } from "next/navigation";
import { useTier } from "@/contexts/TierContext";

// Persistent nudge shown below the pulse composer to accounts with no live
// entitlement. There is no metered free rung — posting is simply closed — so this
// states that plainly rather than rendering a progress bar toward a cap of zero.
export default function PulseUpgradeNudge() {
  const router = useRouter();
  const { hasFullAccess, hadTrial, isLoading } = useTier();

  if (isLoading || hasFullAccess) return null;

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
      <p className="font-mono" style={{ fontSize: 10, color: "#484f58" }}>
        {hadTrial
          ? "// your trial has ended — posting is paused until you pick a plan"
          : "// posting to the pulse feed is part of Member"}
      </p>
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
