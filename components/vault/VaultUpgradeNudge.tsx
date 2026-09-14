"use client";

import Link from "next/link";
import { useTier } from "@/contexts/TierContext";
import Tile from "@/components/ui/Tile";
import ui from "@/components/ui/sleek.module.css";

// Shown in the vault to accounts with no live entitlement. Hidden for paid
// members and for anyone mid-trial.
export default function VaultUpgradeNudge() {
  const { hasFullAccess, isLoading } = useTier();

  if (isLoading) return null;
  if (hasFullAccess) return null;

  return (
    <Tile kicker="Part of a membership" kickerColor="#f8c56a" style={{ marginTop: 20, maxWidth: 820 }}>
      <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text-secondary)" }}>
        You can read everything here. Writing notes and building collections open up with a
        membership.
      </p>
      <Link href="/pricing" className={ui.softBtn} style={{ display: "inline-block", marginTop: 14 }}>
        See membership →
      </Link>
    </Tile>
  );
}
