"use client";

import { useEffect, useRef, useState } from "react";

// The growth stat, drawn as the bar graph onboarding used, and animated when it
// scrolls into view: the bars rise and the multiplier counts up to 2.2×.
//
// Accuracy: the figure is Vistage's own claim about its CEO peer groups, so it
// is attributed to them rather than stated as a rule about founders. The bars
// are drawn to scale (2.2 : 1). Onboarding's version drew 3 : 1 and counted to
// 3.0×, which overstated even the claim it cited.
//
// Server-rendered in its finished state, so it reads without JavaScript and
// never flashes empty. It only rewinds and animates if it's still below the
// fold when the page hydrates, and never under prefers-reduced-motion.

const MULTIPLIER = 2.2;
const BAR_MAX = 200; // px, the members bar
const DURATION_MS = 1400;
const HERO_BG = "linear-gradient(150deg, rgba(245,158,11,.16), rgba(245,158,11,.03) 60%)";

type Phase = "static" | "armed" | "shown";

export default function GrowthStat() {
  const ref = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<Phase>("static");
  const [value, setValue] = useState(MULTIPLIER);

  // Arm the animation only if the graph hasn't been seen yet.
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) return; // already on screen: stay finished
    setPhase("armed");
    setValue(1);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPhase("shown");
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Count the multiplier up alongside the bars.
  useEffect(() => {
    if (phase !== "shown") return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(1 + (MULTIPLIER - 1) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const armed = phase === "armed";
  const bar = (height: number, delayMs: number) => ({
    height: armed ? 0 : height,
    transition: `height ${DURATION_MS}ms cubic-bezier(.2,.7,.2,1) ${delayMs}ms`,
  });

  return (
    <section
      ref={ref}
      data-phase={phase}
      className="rounded-xl p-8 sm:p-12 grid gap-10 md:grid-cols-[1.15fr_1fr] md:items-center"
      style={{ background: HERO_BG, border: "0.5px solid rgba(245,158,11,.3)" }}
    >
      <div>
        <p className="font-mono uppercase text-[0.65rem] tracking-[0.14em] text-amber mb-4">
          {"// the proof"}
        </p>
        <p
          aria-hidden
          className="font-sans font-bold leading-none tracking-tight tabular-nums text-7xl sm:text-8xl"
          style={{ color: "#f8c56a" }}
        >
          {value.toFixed(1)}×
        </p>
        <span className="sr-only">2.2 times</span>
        <h2 className="mt-5 font-sans text-2xl sm:text-3xl font-semibold text-text-primary leading-snug">
          faster growth for companies whose leaders sit in a peer group.
        </h2>
        <p className="mt-4 text-sm text-text-secondary leading-relaxed max-w-md">
          Vistage, a CEO peer-advisory network, reports that its members&rsquo; companies grow 2.2×
          faster than non-members.{" "}
          <a
            href="https://vistage.com/membership/our-approach/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[0.7rem] text-text-muted hover:text-amber whitespace-nowrap"
          >
            source: vistage.com
          </a>
        </p>
      </div>

      <div aria-hidden className="flex flex-col items-center">
        <div className="flex items-end justify-center gap-10" style={{ height: BAR_MAX + 28 }}>
          <div className="flex flex-col items-center gap-2">
            <span className="font-mono text-xs text-amber">2.2×</span>
            <div
              className="w-20 rounded-t"
              style={{
                ...bar(BAR_MAX, 0),
                background: "linear-gradient(to top, #f59e0b, rgba(245,158,11,0.3))",
              }}
            />
          </div>
          <div className="flex flex-col items-center gap-2">
            <span className="font-mono text-xs text-text-muted">1×</span>
            <div
              className="w-20 rounded-t"
              style={{
                ...bar(Math.round(BAR_MAX / MULTIPLIER), 150),
                background: "linear-gradient(to top, #30363d, rgba(48,54,61,0.3))",
              }}
            />
          </div>
        </div>
        <div className="h-px w-60 bg-border" />
        <div className="mt-3 flex justify-center gap-10">
          <span className="w-20 text-center font-mono uppercase text-[0.6rem] tracking-[0.1em] text-text-muted">
            members
          </span>
          <span className="w-20 text-center font-mono uppercase text-[0.6rem] tracking-[0.1em] text-text-muted">
            non-members
          </span>
        </div>
      </div>
    </section>
  );
}
