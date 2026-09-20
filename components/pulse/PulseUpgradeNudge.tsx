"use client";

import { useTier } from "@/contexts/TierContext";
import GradientButton from "@/components/ui/GradientButton";
import ui from "@/components/ui/sleek.module.css";

// Persistent nudge shown below the pulse composer to accounts with no live
// entitlement. There is no metered free rung — posting is simply closed — so this
// states that plainly rather than rendering a progress bar toward a cap of zero.
export default function PulseUpgradeNudge() {
  const { hasFullAccess, hadTrial, isLoading } = useTier();

  if (isLoading || hasFullAccess) return null;

  return (
    <div
      className={`${ui.tile} flex items-center justify-between flex-wrap`}
      style={{ padding: "14px 16px 14px 18px", gap: 12 }}
    >
      <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        {hadTrial
          ? "Your trial has ended. Posting is paused until you pick a plan."
          : "Posting to Pulse is part of Member."}
      </p>
      <GradientButton
        href="/pricing"
        glow
        size={13}
        style={{ fontFamily: "var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif", padding: "8px 14px" }}
      >
        See plans →
      </GradientButton>
    </div>
  );
}
