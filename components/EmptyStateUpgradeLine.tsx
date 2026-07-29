"use client";

import { useTier } from "@/contexts/TierContext";

// A single tier-aware line appended to key empty states. Only renders for
// accounts with no live entitlement — paid and trialing founders see the plain
// empty state.
export default function EmptyStateUpgradeLine({ children }: { children: React.ReactNode }) {
  const { hasFullAccess, isLoading } = useTier();
  if (isLoading || hasFullAccess) return null;
  return (
    <p
      className="font-sans"
      style={{ fontSize: 12, color: "#484f58", marginTop: 12, lineHeight: 1.5 }}
    >
      {children}
    </p>
  );
}
