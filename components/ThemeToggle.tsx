"use client";

import { useTheme } from "@/components/ThemeProvider";

export default function ThemeToggle() {
  const { mode, toggle } = useTheme();
  return (
    <button onClick={toggle} className="btn-ghost" aria-label="toggle theme">
      {mode === "dark" ? "light" : "dark"}
    </button>
  );
}
