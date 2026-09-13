"use client";

import { useEffect } from "react";

// Hides the app-wide background grid while the page that renders this is
// mounted (see `body.no-grid` in sleek.module.css). Lets a page opt into the
// cleaner, grid-free finish without changing every other page.
export default function NoGrid() {
  useEffect(() => {
    document.body.classList.add("no-grid");
    return () => document.body.classList.remove("no-grid");
  }, []);
  return null;
}
