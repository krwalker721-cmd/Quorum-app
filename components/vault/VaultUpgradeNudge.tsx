"use client";

import { useRouter } from "next/navigation";
import { useTier } from "@/contexts/TierContext";

// Subtle "member feature" nudge shown in the vault for free-tier users who are
// not in an active trial. Hidden for paid users and trial users.
export default function VaultUpgradeNudge() {
  const router = useRouter();
  const { tier, status, isLoading } = useTier();

  if (isLoading) return null;
  if (tier !== "free" || status === "trialing") return null;

  return (
    <div
      style={{
        background: "#161b22",
        border: "1px solid #21262d",
        borderRadius: 4,
        padding: "14px 16px",
        marginTop: 16,
      }}
    >
      <p
        className="font-mono"
        style={{ fontSize: 9, color: "#f59e0b", marginBottom: 6, letterSpacing: "0.05em" }}
      >
        // member feature
      </p>
      <p
        className="font-sans"
        style={{ fontSize: 12, color: "#6e7681", marginBottom: 12, lineHeight: 1.5 }}
      >
        Upgrade to Member for unlimited notes, collections, and community wisdom
        access.
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
          padding: 0,
        }}
      >
        upgrade to member →
      </button>
    </div>
  );
}
