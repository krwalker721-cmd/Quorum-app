"use client";

import type { OnboardingStepProps } from "./types";

export default function Step13_DoCheckin(_props: OnboardingStepProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d1117",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
          fontSize: 12,
          color: "#484f58",
        }}
      >
        // step 13 — do checkin
      </span>
    </div>
  );
}
