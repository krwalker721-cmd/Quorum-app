"use client";

import { useTier } from "@/contexts/TierContext";

// A single tier-aware line appended to key empty states. Only renders for
// free-tier users who are not in an active trial — paid and trial users see
// the plain empty state.
export default function EmptyStateUpgradeLine({ children }: { children: React.ReactNode }) {
  const { tier, status, isLoading } = useTier();
  if (isLoading || tier !== "free" || status === "trialing") return null;
  return (
    <p
      className="font-sans"
      style={{ fontSize: 12, color: "#484f58", marginTop: 12, lineHeight: 1.5 }}
    >
      {children}
    </p>
  );
}
