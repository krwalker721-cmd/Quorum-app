"use client";

import { useRouter } from "next/navigation";
import TierPill from "@/components/TierPill";

// Topbar element that shows the user's current tier and routes to /pricing.
// Free/partner users see an "upgrade →" affordance; members see just the pill
// (still clickable so they can manage billing).
export default function TopBarTierLink({ tier }: { tier: string }) {
  const router = useRouter();
  const normalized = (tier || "free").toLowerCase();
  const isMember = normalized === "member";

  if (isMember) {
    return (
      <div
        onClick={() => router.push("/pricing")}
        style={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          height: 28,
        }}
        title="manage billing"
      >
        <TierPill tier={normalized} />
      </div>
    );
  }

  return (
    <div
      onClick={() => router.push("/pricing")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        height: 28,
        background: "transparent",
        border: "1px solid #21262d",
        borderRadius: 4,
        padding: "0 10px",
        cursor: "pointer",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 10,
        color: "#8b949e",
        letterSpacing: "0.06em",
        transition: "border-color 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#f59e0b";
        e.currentTarget.style.color = "#f59e0b";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#21262d";
        e.currentTarget.style.color = "#8b949e";
      }}
    >
      <TierPill tier={normalized} />
      <span>upgrade →</span>
    </div>
  );
}
