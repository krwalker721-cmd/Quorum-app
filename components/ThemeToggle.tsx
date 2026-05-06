"use client";

import { useTheme } from "@/components/ThemeProvider";

export default function ThemeToggle() {
  const { mode, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="font-mono lowercase text-[0.65rem] px-2.5 py-1.5 border transition-colors"
      style={{
        color: "var(--text-muted)",
        borderColor: "var(--border)",
        background: "var(--card)",
      }}
      aria-label="toggle theme"
    >
      {mode === "dark" ? "light" : "dark"}
    </button>
  );
}
