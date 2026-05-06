"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Mode = "dark" | "light";
const ThemeCtx = createContext<{ mode: Mode; toggle: () => void }>({
  mode: "dark",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("dark");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("quorum-theme")) as Mode | null;
    const next = saved === "light" || saved === "dark" ? saved : "dark";
    setMode(next);
    document.documentElement.setAttribute("data-theme", next);
  }, []);

  const toggle = () => {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("quorum-theme", next);
  };

  return <ThemeCtx.Provider value={{ mode, toggle }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
