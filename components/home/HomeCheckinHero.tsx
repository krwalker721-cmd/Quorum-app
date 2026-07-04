"use client";

import { useState } from "react";
import CheckinModal from "@/components/CheckinModal";
import Tile from "@/components/ui/Tile";
import GradientButton from "@/components/ui/GradientButton";

/**
 * WEEKLY CHECK-IN — the amber gradient hero tile on home. Opens the existing
 * CheckinModal (reused, not rebuilt) so the check-in logic stays in one place.
 */
export default function HomeCheckinHero({
  userId,
  prompt = "What decision have you been avoiding?",
}: {
  userId: string;
  prompt?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tile gradient padding="12px 14px">
        <p
          className="font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: "0.12em", color: "#f8c56a", marginBottom: 7 }}
        >
          weekly check-in
        </p>
        <p style={{ fontSize: 12, lineHeight: 1.4, color: "#f5ede0" }}>{prompt}</p>
        <GradientButton onClick={() => setOpen(true)} style={{ marginTop: 10 }}>
          answer →
        </GradientButton>
      </Tile>
      <CheckinModal open={open} onClose={() => setOpen(false)} userId={userId} />
    </>
  );
}
