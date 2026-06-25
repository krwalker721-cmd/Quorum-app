"use client";

import { useRef } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { Chapter, StickyStage, useChapterScroll } from "./sticky";
import { useOnboardingScroll } from "./scroll";
import { C, MONO, SANS } from "./theme";

// Depth drives size, opacity and drift speed — closer founders (depth 1) are
// larger, brighter and move faster, creating a parallax sense of moving through
// a room of people.
interface Founder {
  name: string;
  outcome: string;
  detail: string;
  depth: 1 | 2 | 3;
  top: number; // % of viewport height
  left: number; // % of viewport width
  appearAt: number; // scroll progress
  disappearAt: number;
}

const FOUNDERS: Founder[] = [
  { name: "Marcus R.", outcome: "hit $23k MRR", detail: "first time we've ever been here", depth: 1, top: 15, left: 8, appearAt: 0.02, disappearAt: 0.7 },
  { name: "Aisha L.", outcome: "made the call on pricing", detail: "after 3 weeks of sitting on it", depth: 2, top: 35, left: 55, appearAt: 0.06, disappearAt: 0.78 },
  { name: "James P.", outcome: "hired our first engineer", detail: "through the network — saved 4 months", depth: 1, top: 55, left: 30, appearAt: 0.12, disappearAt: 0.85 },
  { name: "Sara K.", outcome: "closed a $180k contract", detail: "used a framework from the vault", depth: 3, top: 72, left: 62, appearAt: 0.18, disappearAt: 0.9 },
  { name: "Tom N.", outcome: "decided not to raise", detail: "best decision I've made", depth: 2, top: 20, left: 68, appearAt: 0.24, disappearAt: 0.95 },
  { name: "Bianca K.", outcome: "0 to 12 paying customers", detail: "in 6 weeks after posting my GTM question", depth: 1, top: 45, left: 6, appearAt: 0.3, disappearAt: 1 },
  { name: "Chris L.", outcome: "found my co-founder here", detail: "we shipped v1 three months later", depth: 3, top: 65, left: 12, appearAt: 0.36, disappearAt: 1 },
  { name: "Rosa V.", outcome: "$0 to $8k MRR in 90 days", detail: "I was going to quit before I joined", depth: 2, top: 30, left: 38, appearAt: 0.42, disappearAt: 1 },
];

const DRIFT = { 1: -120, 2: -60, 3: -30 } as const;
// Nearer founders react more to the pointer (stronger parallax).
const PARALLAX = { 1: 34, 2: 20, 3: 11 } as const;
const NAME_SIZE = { 1: 11, 2: 10, 3: 9 } as const;
const OUTCOME_SIZE = { 1: 14, 2: 13, 3: 11 } as const;
const OUTCOME_COLOR = { 1: C.textPrimary, 2: C.textSecondary, 3: C.textMuted } as const;
const PEAK_OPACITY = { 1: 0.9, 2: 0.6, 3: 0.35 } as const;

function FounderItem({
  f,
  progress,
  pointerX,
  pointerY,
}: {
  f: Founder;
  progress: MotionValue<number>;
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
}) {
  // Scroll drift + pointer parallax, weighted by depth.
  const x = useTransform(
    [progress, pointerX] as [MotionValue<number>, MotionValue<number>],
    ([p, px]: number[]) => p * DRIFT[f.depth] + px * PARALLAX[f.depth],
  );
  const y = useTransform(pointerY, [-1, 1], [-PARALLAX[f.depth] * 0.6, PARALLAX[f.depth] * 0.6]);
  const opacity = useTransform(
    progress,
    [f.appearAt, f.appearAt + 0.08, f.disappearAt - 0.1, f.disappearAt],
    [0, PEAK_OPACITY[f.depth], PEAK_OPACITY[f.depth], 0],
  );

  return (
    <motion.div
      style={{
        position: "absolute",
        x,
        y,
        opacity,
        top: `${f.top}%`,
        left: `${f.left}%`,
        maxWidth: 280,
        pointerEvents: "none",
        willChange: "opacity, transform",
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: NAME_SIZE[f.depth],
          color: C.amber,
          letterSpacing: "0.06em",
          marginBottom: 3,
        }}
      >
        {f.name}
      </div>
      <div
        style={{
          fontFamily: SANS,
          fontSize: OUTCOME_SIZE[f.depth],
          color: OUTCOME_COLOR[f.depth],
          fontWeight: 500,
          marginBottom: 2,
        }}
      >
        {f.outcome}
      </div>
      <div
        style={{
          fontFamily: SANS,
          fontSize: f.depth === 1 ? 12 : 11,
          color: C.textDisabled,
          fontStyle: "italic",
        }}
      >
        &ldquo;{f.detail}&rdquo;
      </div>
    </motion.div>
  );
}

// Chapter 6 — founder names and outcomes drift across a dark space at different
// depths as the user scrolls. No interaction; pure atmosphere.
export function ChapterFounderNames() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useChapterScroll(ref);
  const { pointerX, pointerY } = useOnboardingScroll();

  return (
    <Chapter ref={ref} id="chapter-6" label="the room" heightVh={300}>
      <StickyStage center={false} style={{ position: "sticky" }}>
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          {FOUNDERS.map((f) => (
            <FounderItem
              key={f.name}
              f={f}
              progress={scrollYProgress}
              pointerX={pointerX}
              pointerY={pointerY}
            />
          ))}
        </div>
      </StickyStage>
    </Chapter>
  );
}
