"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import s from "./landing.module.css";

// Fades a block up as it scrolls into view. Server-rendered visible, and only
// "armed" (hidden, waiting) when JavaScript runs and the block is still below
// the fold, so nothing is ever lost without JS, and nothing already on screen
// blinks out. Skipped entirely under prefers-reduced-motion.
export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"static" | "armed" | "in">("static");

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) return; // already visible
    setState("armed");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("in");
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const motion = state === "armed" ? s.reveal : state === "in" ? `${s.reveal} ${s.revealIn}` : "";

  return (
    <div
      ref={ref}
      className={`${className} ${motion}`}
      style={state === "in" && delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
