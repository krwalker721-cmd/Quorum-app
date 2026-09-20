"use client";

import { useState } from "react";
import CheckinModal from "@/components/CheckinModal";
import Tile from "@/components/ui/Tile";
import GradientButton from "@/components/ui/GradientButton";
import ui from "@/components/ui/sleek.module.css";

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
      <Tile gradient padding="20px 22px">
        <p className={ui.label} style={{ color: "#f8c56a", marginBottom: 8 }}>
          Weekly check-in
        </p>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.4,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: "#f5ede0",
          }}
        >
          {prompt}
        </p>
        <GradientButton
          glow
          size={13}
          onClick={() => setOpen(true)}
          style={{
            marginTop: 16,
            padding: "9px 15px",
            fontFamily: "var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif",
          }}
        >
          Answer →
        </GradientButton>
      </Tile>
      <CheckinModal open={open} onClose={() => setOpen(false)} userId={userId} />
    </>
  );
}
