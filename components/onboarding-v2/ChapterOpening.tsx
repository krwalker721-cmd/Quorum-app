"use client";

import { useRef } from "react";
import { motion, useTransform, useMotionTemplate, type MotionValue } from "framer-motion";
import { Chapter, StickyStage, useChapterScroll } from "./sticky";
import { C, MONO, SANS, hexToRgba } from "./theme";

const WORD = "QUORUM";

// Each letter of the wordmark slams into place from a different direction with a
// rotation, scale and blur — scrubbed against scroll. Then the assembled mark is
// pushed through (scaled up + faded) as the user scrolls on, like the camera
// flying into it.
function Letter({
  char,
  progress,
  i,
  count,
}: {
  char: string;
  progress: MotionValue<number>;
  i: number;
  count: number;
}) {
  // Letters assemble across 0.08–0.46, staggered.
  const t0 = 0.08 + (i / count) * 0.3;
  const t1 = t0 + 0.16;
  const dir = i % 2 === 0 ? -1 : 1;
  const y = useTransform(progress, [t0, t1], [dir * 140, 0]);
  const rotate = useTransform(progress, [t0, t1], [dir * 28, 0]);
  const scale = useTransform(progress, [t0, t1], [1.8, 1]);
  const opacity = useTransform(progress, [t0, t0 + 0.06], [0, 1]);
  const blurPx = useTransform(progress, [t0, t1], [14, 0]);
  const filter = useMotionTemplate`blur(${blurPx}px)`;
  return (
    <motion.span
      style={{
        display: "inline-block",
        y,
        rotate,
        scale,
        opacity,
        filter,
        willChange: "transform, opacity, filter",
      }}
    >
      {char}
    </motion.span>
  );
}

// Chapter 0 — the cold open. The wordmark builds, a loader counts to 100, a
// tagline wipes in, then the whole title is pushed through into the question.
export function ChapterOpening() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useChapterScroll(ref);
  const letters = WORD.split("");

  // Loader count 00 → 100 across the build.
  const count = useTransform(scrollYProgress, [0.04, 0.5], [0, 100]);
  const countText = useTransform(count, (v) => String(Math.round(v)).padStart(2, "0"));
  const loaderWidth = useTransform(scrollYProgress, [0.04, 0.5], ["0%", "100%"]);
  const loaderOpacity = useTransform(scrollYProgress, [0.04, 0.5, 0.62], [1, 1, 0]);

  // Eyebrow + tagline.
  const eyebrowOpacity = useTransform(scrollYProgress, [0.02, 0.1, 0.6, 0.7], [0, 1, 1, 0]);
  const taglineY = useTransform(scrollYProgress, [0.46, 0.6], ["120%", "0%"]);
  const taglineOpacity = useTransform(scrollYProgress, [0.46, 0.58, 0.72, 0.82], [0, 1, 1, 0]);

  // Push-through: the assembled mark scales up and fades as you scroll out.
  const markScale = useTransform(scrollYProgress, [0.5, 1], [1, 7]);
  const markOpacity = useTransform(scrollYProgress, [0.5, 0.7, 0.92], [1, 1, 0]);
  const markBlur = useTransform(scrollYProgress, [0.6, 0.95], [0, 16]);
  const markFilter = useMotionTemplate`blur(${markBlur}px)`;

  // Scroll cue, only at the very start.
  const cueOpacity = useTransform(scrollYProgress, [0, 0.04, 0.12], [1, 1, 0]);

  // Underline rule grows as the mark assembles.
  const ruleWidth = useTransform(scrollYProgress, [0.3, 0.5], ["0%", "100%"]);

  return (
    <Chapter ref={ref} id="chapter-0" heightVh={260}>
      <StickyStage>
        {/* Eyebrow */}
        <motion.div
          style={{
            opacity: eyebrowOpacity,
            fontFamily: MONO,
            fontSize: 11,
            color: C.amber,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            marginBottom: 28,
          }}
        >
          welcome to the room
        </motion.div>

        {/* The wordmark — pushed through on exit. */}
        <motion.div
          style={{
            scale: markScale,
            opacity: markOpacity,
            filter: markFilter,
            transformOrigin: "center center",
            willChange: "transform, opacity, filter",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: SANS,
              fontSize: "clamp(46px, 11vw, 132px)",
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: C.textPrimary,
              lineHeight: 1,
              display: "flex",
              justifyContent: "center",
              flexWrap: "nowrap",
            }}
          >
            {letters.map((ch, i) => (
              <Letter key={i} char={ch} progress={scrollYProgress} i={i} count={letters.length} />
            ))}
          </div>
          <motion.div
            style={{
              width: ruleWidth,
              height: 2,
              maxWidth: 480,
              margin: "18px auto 0",
              background: `linear-gradient(90deg, transparent, ${hexToRgba(C.amber, 0.7)}, transparent)`,
            }}
          />
        </motion.div>

        {/* Tagline */}
        <div style={{ overflow: "hidden", marginTop: 26 }}>
          <motion.p
            style={{
              y: taglineY,
              opacity: taglineOpacity,
              fontFamily: SANS,
              fontSize: "clamp(15px, 2.4vw, 20px)",
              fontWeight: 400,
              color: C.textSecondary,
              textAlign: "center",
              maxWidth: 520,
              margin: 0,
              lineHeight: 1.5,
              willChange: "transform",
            }}
          >
            A room of founders who&rsquo;ve already been where you&rsquo;re going.
          </motion.p>
        </div>

        {/* Loader */}
        <motion.div
          style={{
            opacity: loaderOpacity,
            position: "absolute",
            bottom: "10%",
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.textMuted, letterSpacing: "0.2em" }}>
            <motion.span>{countText}</motion.span>
            <span style={{ color: C.textDisabled }}> / 100</span>
          </div>
          <div
            style={{
              width: "min(220px, 50vw)",
              height: 1,
              background: hexToRgba(C.textPrimary, 0.08),
              overflow: "hidden",
            }}
          >
            <motion.div style={{ width: loaderWidth, height: "100%", background: C.amber }} />
          </div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          style={{
            opacity: cueOpacity,
            position: "absolute",
            bottom: "5%",
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 10,
            color: C.textDisabled,
            letterSpacing: "0.2em",
          }}
        >
          scroll to enter ↓
        </motion.div>
      </StickyStage>
    </Chapter>
  );
}
