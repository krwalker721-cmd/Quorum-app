"use client";

// The living background. One fixed layer behind the whole onboarding that rides
// document scroll + pointer, so there is never a moment where nothing responds.
//
// PERFORMANCE: every animated property here is compositor-only — transform and
// opacity. Nothing animates a gradient *string* or a filter on a moving element
// (that forces a full-screen repaint every frame and was the cause of the
// earlier choppiness). Each glow is a single static-gradient bitmap, blurred
// once, then only translated/scaled/faded. The hue journey (cool → warm across
// the scroll) is done by cross-fading three fixed-colour glows via opacity, not
// by interpolating colours.

import { motion, useTransform, type MotionValue } from "framer-motion";
import { useOnboardingScroll } from "./scroll";
import { NetworkField } from "./NetworkField";
import { C, hexToRgba } from "./theme";

// A single blurred glow: static colour, driven only by transform + opacity.
function Glow({
  color,
  opacity,
  x,
  y,
  scale,
  rotate,
  size,
  corner,
}: {
  color: string;
  opacity: MotionValue<number>;
  x: MotionValue<number>;
  y: MotionValue<number>;
  scale: MotionValue<number>;
  rotate?: MotionValue<number>;
  size: string;
  corner: "tl" | "br" | "c";
}) {
  const pos =
    corner === "tl"
      ? { top: 0, left: 0 }
      : corner === "br"
        ? { bottom: 0, right: 0 }
        : { top: "20%", left: "30%" };
  return (
    <motion.div
      style={{
        position: "absolute",
        ...pos,
        width: size,
        height: size,
        x,
        y,
        scale,
        rotate,
        opacity,
        background: `radial-gradient(closest-side, ${color} 0%, transparent 72%)`,
        filter: "blur(64px)",
        willChange: "transform, opacity",
      }}
    />
  );
}

export function Atmosphere() {
  const { progress, pointerX, pointerY } = useOnboardingScroll();
  // Local aliases so the inline transforms read cleanly.
  const p = progress;
  const px = pointerX;
  const py = pointerY;

  // ── Glow A (teal): dominant at the analytical opening, gone by the middle.
  const aOpacity = useTransform(p, [0, 0.12, 0.42], [0.14, 0.2, 0]);
  const aX = useTransform([p, px] as [MotionValue<number>, MotionValue<number>], ([v, m]: number[]) => -60 + v * 220 + m * 36);
  const aY = useTransform([p, py] as [MotionValue<number>, MotionValue<number>], ([v, m]: number[]) => -40 + v * 160 + m * 28);
  const aScale = useTransform(p, [0, 0.5], [1, 1.3]);

  // ── Glow B (purple): the personal middle.
  const bOpacity = useTransform(p, [0.18, 0.45, 0.78], [0, 0.16, 0.02]);
  const bX = useTransform([p, px] as [MotionValue<number>, MotionValue<number>], ([v, m]: number[]) => 200 - v * 320 - m * 30);
  const bY = useTransform([p, py] as [MotionValue<number>, MotionValue<number>], ([v, m]: number[]) => 320 - v * 240 - m * 22);
  const bScale = useTransform(p, [0.2, 0.8], [0.9, 1.25]);
  const bRotate = useTransform(p, [0, 1], [0, 30]);

  // ── Glow C (amber, restrained): warms in only toward the decision.
  const cOpacity = useTransform(p, [0.55, 0.85, 1], [0, 0.12, 0.16]);
  const cX = useTransform([p, px] as [MotionValue<number>, MotionValue<number>], ([v, m]: number[]) => 60 - v * 100 + m * 24);
  const cY = useTransform([p, py] as [MotionValue<number>, MotionValue<number>], ([v, m]: number[]) => -20 + v * 220 + m * 30);
  const cScale = useTransform(p, [0.55, 1], [1, 1.2]);

  // ── Grid parallax + contrast breathing (transform + opacity only).
  const gridY = useTransform(progress, [0, 1], [0, -70]);
  const gridOpacity = useTransform(progress, [0, 0.5, 1], [0.5, 0.8, 0.42]);

  // ── A second deepening vignette fades in toward the end (opacity only).
  const endVignette = useTransform(progress, [0.6, 1], [0, 0.5]);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        overflow: "hidden",
        pointerEvents: "none",
        background: C.bg,
      }}
    >
      <Glow color="#38bdf8" opacity={aOpacity} x={aX} y={aY} scale={aScale} size="70vw" corner="tl" />
      <Glow color="#a78bfa" opacity={bOpacity} x={bX} y={bY} scale={bScale} rotate={bRotate} size="64vw" corner="br" />
      <Glow color={C.amber} opacity={cOpacity} x={cX} y={cY} scale={cScale} size="58vw" corner="c" />

      {/* Network constellation — the founder graph, drifting on its own loop. */}
      <NetworkField />

      {/* Blueprint grid — parallaxing. */}
      <motion.div
        style={{
          position: "absolute",
          inset: "-80px 0",
          y: gridY,
          opacity: gridOpacity,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
          willChange: "transform, opacity",
        }}
      />

      {/* Continuous grain — transform-only shimmer so the canvas is never still. */}
      <div
        data-quorum-grain
        style={{
          position: "absolute",
          inset: "-30%",
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          animation: "quorum-grain 6s steps(5) infinite",
          willChange: "transform",
        }}
      />

      {/* Static base vignette (no per-frame work). */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 50% 40%, transparent 32%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      {/* Extra deepening into the decision — opacity-only fade-in. */}
      <motion.div
        style={{
          position: "absolute",
          inset: 0,
          opacity: endVignette,
          background:
            `radial-gradient(circle at 50% 46%, transparent 18%, ${hexToRgba("#000000", 0.85)} 92%)`,
        }}
      />

      <style>{`
        @keyframes quorum-grain {
          0%   { transform: translate(0, 0); }
          25%  { transform: translate(-5%, 3%); }
          50%  { transform: translate(4%, -5%); }
          75%  { transform: translate(-3%, -2%); }
          100% { transform: translate(0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-quorum-grain] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
