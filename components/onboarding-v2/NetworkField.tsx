"use client";

// An ambient founder network drifting behind the whole experience — nodes that
// wander and link to their nearest neighbours, the literal metaphor of Quorum
// rendered as living background. Deliberately cheap and decoupled:
//   • a fixed, capped node count (no growth, O(n²) over a small n)
//   • its own rAF throttled to ~30fps, independent of scroll
//   • parallax comes from reading the shared scroll/pointer MotionValues inside
//     the loop (no React renders, no per-frame layout)
//   • pauses when the tab is hidden or reduced motion is requested
//
// Two depth layers (near/far) drift and parallax at different rates for real
// dimensionality.

import { useEffect, useRef } from "react";
import { useOnboardingScroll } from "./scroll";

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  depth: number; // 0.4 (far) .. 1 (near)
}

const NEAR_COUNT = 26;
const FAR_COUNT = 16;
const LINK_DIST = 150;
const FRAME_MS = 1000 / 30;

export function NetworkField() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { progress, pointerX, pointerY } = useOnboardingScroll();

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !ref.current) return;
    // Reordered guard so `cv`/`cx` infer non-null declared types — otherwise the
    // nested resize()/step() closures see them as possibly-null.
    const cv = ref.current;
    const cx = cv.getContext("2d")!;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize, { passive: true });

    const make = (depth: number): Node => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.18 * depth,
      vy: (Math.random() - 0.5) * 0.18 * depth,
      depth,
    });
    const nodes: Node[] = [
      ...Array.from({ length: NEAR_COUNT }, () => make(0.7 + Math.random() * 0.3)),
      ...Array.from({ length: FAR_COUNT }, () => make(0.4 + Math.random() * 0.2)),
    ];

    let raf = 0;
    let last = 0;
    let running = true;

    function step(t: number) {
      raf = requestAnimationFrame(step);
      if (!running) return;
      if (t - last < FRAME_MS) return;
      last = t;

      const p = progress.get();
      const mx = pointerX.get();
      const my = pointerY.get();
      // Scroll pushes the field upward; the pointer nudges it for at-rest depth.
      const driftY = -p * 120;
      const hue = p; // 0 cool → 1 warm, picked per-link below

      cx.clearRect(0, 0, w, h);

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -40) n.x = w + 40;
        if (n.x > w + 40) n.x = -40;
        if (n.y < -40) n.y = h + 40;
        if (n.y > h + 40) n.y = -40;
      }

      // Links — only between nodes of comparable depth, fading with distance.
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        const ax = a.x + mx * 22 * a.depth;
        const ay = a.y + driftY * a.depth + my * 16 * a.depth;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          if (Math.abs(a.depth - b.depth) > 0.35) continue;
          const bx = b.x + mx * 22 * b.depth;
          const by = b.y + driftY * b.depth + my * 16 * b.depth;
          const dx = ax - bx;
          const dy = ay - by;
          const dist = Math.hypot(dx, dy);
          if (dist > LINK_DIST) continue;
          const alpha = (1 - dist / LINK_DIST) * 0.12 * a.depth;
          // Cool teal early → warm amber late.
          const r = Math.round(56 + hue * (245 - 56));
          const g = Math.round(189 + hue * (158 - 189));
          const bch = Math.round(248 + hue * (11 - 248));
          cx.strokeStyle = `rgba(${r},${g},${bch},${alpha})`;
          cx.lineWidth = 1;
          cx.beginPath();
          cx.moveTo(ax, ay);
          cx.lineTo(bx, by);
          cx.stroke();
        }
      }

      // Nodes.
      for (const n of nodes) {
        const x = n.x + mx * 22 * n.depth;
        const y = n.y + driftY * n.depth + my * 16 * n.depth;
        const r = Math.round(56 + hue * (245 - 56));
        const g = Math.round(189 + hue * (158 - 189));
        const bch = Math.round(248 + hue * (11 - 248));
        cx.fillStyle = `rgba(${r},${g},${bch},${0.22 * n.depth})`;
        cx.beginPath();
        cx.arc(x, y, 1.4 * n.depth, 0, Math.PI * 2);
        cx.fill();
      }
    }
    raf = requestAnimationFrame(step);

    const onVis = () => {
      running = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [progress, pointerX, pointerY]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
