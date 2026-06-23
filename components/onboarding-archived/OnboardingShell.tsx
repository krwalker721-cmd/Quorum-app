"use client";

import type { ReactNode } from "react";

const MONO = "var(--font-jetbrains-mono), ui-monospace, monospace";

interface OnboardingShellProps {
  currentStep: number;
  totalSteps: number;
  children: ReactNode;
}

// The chrome every onboarding step renders inside: background grid, left-edge
// row numbers, top/bottom status bars, the Q/ QUORUM logo, and the segmented
// progress bar. Content goes in the children slot.
export default function OnboardingShell({
  currentStep,
  totalSteps,
  children,
}: OnboardingShellProps) {
  const stepLabel = String(currentStep).padStart(2, "0");
  const rowNumbers = Array.from({ length: 18 }, (_, i) => String(i + 1).padStart(2, "0"));
  const segments = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#0d1117",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* background grid — white lines at 0.03 opacity on a 28px grid */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          pointerEvents: "none",
        }}
      />

      {/* row numbers down the left edge (01–18) */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 52,
          left: 8,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          pointerEvents: "none",
        }}
      >
        {rowNumbers.map((n) => (
          <span key={n} style={{ fontFamily: MONO, fontSize: 9, lineHeight: 1, color: "#21262d" }}>
            {n}
          </span>
        ))}
      </div>

      {/* top status bar */}
      <div style={{ position: "relative", borderBottom: "1px solid #21262d", padding: "8px 16px" }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "#484f58" }}>
          QUORUM_OS v1.0 | ONBOARDING | STEP_{stepLabel} / {totalSteps}
        </span>
      </div>

      {/* logo row */}
      <div style={{ position: "relative", padding: "12px 16px 10px" }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.04em" }}>
          <span style={{ color: "#f59e0b" }}>Q/</span>{" "}
          <span style={{ color: "#8b949e" }}>QUORUM</span>
        </span>
      </div>

      {/* crosshair line below the logo row */}
      <div aria-hidden style={{ position: "relative", height: 1, background: "#21262d" }} />

      {/* progress bar — one segment per step */}
      <div style={{ position: "relative", display: "flex", gap: 2 }}>
        {segments.map((s) => {
          const color = s < currentStep ? "#30363d" : s === currentStep ? "#f59e0b" : "#21262d";
          return <div key={s} style={{ flex: 1, height: 2, background: color }} />;
        })}
      </div>

      {/* step content */}
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
        {children}
      </div>

      {/* bottom status bar */}
      <div
        style={{
          position: "relative",
          borderTop: "1px solid #21262d",
          padding: "6px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 10, color: "#21262d" }}>QUORUM_OS v1.0</span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: "#21262d" }}>● LIVE</span>
      </div>
    </div>
  );
}
