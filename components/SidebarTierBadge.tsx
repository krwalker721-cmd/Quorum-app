"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TierPill from "@/components/TierPill";

// Subtle tier pill near the bottom of the sidebar. Fetches the user's tier on
// mount and routes to /settings when clicked. Hidden while collapsed.
export default function SidebarTierBadge({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const [tier, setTier] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setTier(d.tier))
      .catch(() => {});
  }, []);

  if (collapsed || !tier) return null;

  return (
    <button
      type="button"
      onClick={() => router.push("/settings")}
      title="manage subscription"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        background: "transparent",
        border: "none",
        borderTop: "1px solid var(--border-default)",
        cursor: "pointer",
        width: "100%",
      }}
    >
      <span className="font-mono lowercase" style={{ fontSize: 10, color: "var(--text-muted)" }}>
        plan
      </span>
      <TierPill tier={tier} />
    </button>
  );
}
