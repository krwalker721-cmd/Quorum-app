"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Mode = "normal" | "high-contrast";
const ThemeCtx = createContext<{ mode: Mode; toggle: () => void }>({
  mode: "normal",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("normal");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("quorum-theme") : null;
    // Accept new values; gracefully migrate legacy "dark"/"light" → "normal".
    const next: Mode = saved === "high-contrast" ? "high-contrast" : "normal";
    setMode(next);
    document.documentElement.setAttribute("data-theme", next);

    // Appearance preferences from Settings. Re-applied on every load; they used
    // to be set only when changed, so a reload quietly undid them.
    try {
      const root = document.documentElement;
      const size = localStorage.getItem("quorum-font-size");
      if (size === "small" || size === "default" || size === "large") {
        root.classList.remove("font-size-small", "font-size-default", "font-size-large");
        root.classList.add(`font-size-${size}`);
      }
      root.classList.toggle("prefers-reduced-motion", localStorage.getItem("quorum-reduce-motion") === "1");
    } catch {
      // storage unavailable (private mode): keep the defaults
    }
  }, []);

  const toggle = () => {
    const next: Mode = mode === "normal" ? "high-contrast" : "normal";
    setMode(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("quorum-theme", next);
  };

  return <ThemeCtx.Provider value={{ mode, toggle }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
