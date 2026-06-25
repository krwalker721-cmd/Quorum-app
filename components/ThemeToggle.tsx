"use client";

import { useTheme } from "@/components/ThemeProvider";

// Small circular flip icon that toggles high-contrast mode. The circle rotates
// 180° and inverts its fill to telegraph the current state — no text label.
export default function ThemeToggle() {
  const { mode, toggle } = useTheme();
  const contrastMode = mode === "high-contrast";
  return (
    <button
      onClick={toggle}
      title="Toggle contrast"
      aria-label="toggle high contrast mode"
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: contrastMode ? "#e6edf3" : "#161b22",
        border: "1px solid #21262d",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.2s, transform 0.3s",
        transform: contrastMode ? "rotate(180deg)" : "rotate(0deg)",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="5" stroke={contrastMode ? "#0d1117" : "#8b949e"} strokeWidth="1" />
        <path d="M6 1 A5 5 0 0 1 6 11 Z" fill={contrastMode ? "#0d1117" : "#8b949e"} />
      </svg>
    </button>
  );
}
