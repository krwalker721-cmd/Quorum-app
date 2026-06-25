"use client";

// Shared scaffolding for the sticky-pin scroll pattern used throughout the
// cinematic onboarding. An outer element of `heightVh` creates the scroll
// distance; the inner element pins to the viewport (sticky, 100vh) while the
// outer scrolls past, and content inside animates against scroll progress.
//
//   const ref = useRef(null)
//   const { scrollYProgress } = useChapterScroll(ref)
//   <Chapter ref={ref} id="chapter-2" label="proof" heightVh={300}>
//     <StickyStage>{/* animates against scrollYProgress */}</StickyStage>
//   </Chapter>
//
// Two cross-cutting ideas keep the scroll from ever feeling like a static page:
//   1. usePageScroll() — a springed, document-wide progress value the persistent
//      Atmosphere and ProgressSpine ride, so *every* pixel of scroll moves
//      something, even between chapters.
//   2. useDepth()/DepthLayer — chapters rise out of the background and recede
//      back into it (scale + fade) so moments cross-dissolve through the
//      atmosphere rather than hard-cutting.

import {
  forwardRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useOnboardingScroll } from "./scroll";
import { MONO } from "./theme";

// Track scroll progress through a specific chapter element. 0 = the element's
// top hits the viewport top; 1 = the element's bottom hits the viewport bottom.
export function useChapterScroll(ref: RefObject<HTMLElement>) {
  return useScroll({ target: ref, offset: ["start start", "end end"] });
}

// Document-wide scroll progress (0 at the very top, 1 at the very bottom),
// springed so the layers riding it (atmosphere, spine) ease with weight instead
// of snapping 1:1 to the scrollbar. This is what gives the whole experience its
// inertial, "heavy" feel without a smooth-scroll dependency.
export function usePageScroll() {
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, {
    stiffness: 70,
    damping: 26,
    mass: 0.6,
    restDelta: 0.0005,
  });
  return { raw: scrollYProgress, smooth };
}

// The tall outer container that creates a chapter's scroll runway. `label` (and
// the data attribute it sets) lets the ProgressSpine discover and name chapters
// from the DOM, so it stays correct through any reordering.
export const Chapter = forwardRef<
  HTMLDivElement,
  {
    id?: string;
    label?: string;
    heightVh: number;
    children: ReactNode;
    style?: CSSProperties;
  }
>(function Chapter({ id, label, heightVh, children, style }, ref) {
  return (
    <div
      ref={ref}
      id={id}
      data-chapter={label ?? ""}
      style={{ height: `${heightVh}vh`, position: "relative", ...style }}
    >
      {children}
    </div>
  );
});

// The pinned viewport. Centers its content by default; pass `center={false}`
// for chapters (founder drift, horizontal collab) that position absolutely.
export function StickyStage({
  children,
  center = true,
  style,
}: {
  children: ReactNode;
  center?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        height: "100vh",
        overflow: "hidden",
        boxSizing: "border-box",
        ...(center
          ? {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "48px 20px",
            }
          : { position: "sticky" }),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Depth cross-dissolve ────────────────────────────────────────────────────
// As a chapter scrolls through, its content rises out of the atmosphere (scale
// up + fade in), holds at rest, then recedes back into it (scale up further +
// fade out). Because the persistent Atmosphere is always visible behind, the
// hand-off between chapters reads as one continuous space rather than a cut.
export function useDepth(
  progress: MotionValue<number>,
  hold: [number, number] = [0.18, 0.82],
) {
  const opacity = useTransform(progress, [0, hold[0], hold[1], 1], [0, 1, 1, 0]);
  const scale = useTransform(progress, [0, hold[0], hold[1], 1], [0.92, 1, 1, 1.08]);
  return { opacity, scale };
}

// Convenience wrapper that applies useDepth to its children.
export function DepthLayer({
  progress,
  hold,
  children,
  style,
}: {
  progress: MotionValue<number>;
  hold?: [number, number];
  children: ReactNode;
  style?: CSSProperties;
}) {
  const { opacity, scale } = useDepth(progress, hold);
  return (
    <motion.div
      style={{ opacity, scale, willChange: "opacity, transform", ...style }}
    >
      {children}
    </motion.div>
  );
}

// ─── Ghost chapter number ────────────────────────────────────────────────────
// A huge, barely-there number anchored to a chapter for depth and structure (the
// award-site trope). Parallaxes vertically with the chapter's own scroll, drifts
// with the pointer, and skews subtly with scroll velocity so fast flings streak
// it. Purely decorative — `aria-hidden`, very low opacity.
export function GhostNumber({
  value,
  progress,
  align = "left",
}: {
  value: string;
  progress: MotionValue<number>;
  align?: "left" | "right";
}) {
  const { pointerX, velocity } = useOnboardingScroll();
  const y = useTransform(progress, [0, 1], [120, -120]);
  const x = useTransform(pointerX, [-1, 1], [-24, 24]);
  const skewY = useTransform(velocity, [-1.5, 1.5], [5, -5], { clamp: true });
  const opacity = useTransform(progress, [0, 0.2, 0.8, 1], [0, 0.05, 0.05, 0]);
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        ...(align === "left" ? { left: "4%" } : { right: "4%" }),
        display: "flex",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <motion.div
        style={{
          y,
          x,
          skewY,
          opacity,
          fontFamily: MONO,
          fontSize: "clamp(160px, 34vw, 420px)",
          fontWeight: 700,
          lineHeight: 0.8,
          color: "#e6edf3",
          letterSpacing: "-0.04em",
          userSelect: "none",
          willChange: "transform, opacity",
        }}
      >
        {value}
      </motion.div>
    </div>
  );
}

// ─── Scrubbed text ───────────────────────────────────────────────────────────
// A single line that wipes up from behind a clip mask as `progress` moves
// through `range`. Scroll-scrubbed and fully reversible — the signature
// line-reveal of cinematic-scroll sites, never a one-shot whileInView fade.
export function MaskLine({
  children,
  progress,
  range,
  lift = 115,
  style,
}: {
  children: ReactNode;
  progress: MotionValue<number>;
  range: [number, number];
  lift?: number;
  style?: CSSProperties;
}) {
  const span = range[1] - range[0];
  const y = useTransform(progress, range, [`${lift}%`, "0%"]);
  const opacity = useTransform(
    progress,
    [range[0], range[0] + span * 0.55],
    [0, 1],
  );
  return (
    <span style={{ display: "block", overflow: "hidden", paddingBottom: "0.04em" }}>
      <motion.span
        style={{ display: "block", y, opacity, willChange: "transform", ...style }}
      >
        {children}
      </motion.span>
    </span>
  );
}
