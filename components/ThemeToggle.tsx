"use client";

import { useTheme } from "@/components/ThemeProvider";

export default function ThemeToggle() {
  const { mode, toggle } = useTheme();
  const label = mode === "normal" ? "contrast" : "normal";
  return (
    <button
      onClick={toggle}
      className="btn-ghost"
      aria-label="toggle high contrast mode"
      title={mode === "normal" ? "switch to high contrast" : "switch to normal"}
    >
      {label}
    </button>
  );
}
