"use client";

import { useRef } from "react";
import { motion, useTransform } from "framer-motion";
import { Chapter, StickyStage, useChapterScroll, GhostNumber } from "./sticky";
import { C, MONO, SANS } from "./theme";

// Chapter 2 — the visceral beat: the user literally scrolls the bars up. The
// "with a network" bar grows faster and taller than "without"; the stat and
// source fade in once both bars have settled.
export function ChapterBarGraph() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useChapterScroll(ref);

  const leftBarHeight = useTransform(scrollYProgress, [0.1, 0.6], [0, 180]);
  const rightBarHeight = useTransform(scrollYProgress, [0.15, 0.55], [0, 60]);
  const labelOpacity = useTransform(scrollYProgress, [0.05, 0.15], [0, 1]);
  const statOpacity = useTransform(scrollYProgress, [0.65, 0.8], [0, 1]);
  const statY = useTransform(scrollYProgress, [0.65, 0.8], [20, 0]);
  const sourceOpacity = useTransform(scrollYProgress, [0.75, 0.85], [0, 1]);

  // A live multiplier that climbs from 1.0× to 3.0× exactly as the bars grow —
  // the data point assembles under the user's thumb.
  const mult = useTransform(scrollYProgress, [0.1, 0.6], [1, 3]);
  const multText = useTransform(mult, (v) => `${v.toFixed(1)}×`);
  const multOpacity = useTransform(scrollYProgress, [0.08, 0.16], [0, 1]);

  // Exit recede into the atmosphere.
  const exitOpacity = useTransform(scrollYProgress, [0.86, 1], [1, 0]);
  const exitScale = useTransform(scrollYProgress, [0.86, 1], [1, 1.06]);

  return (
    <Chapter ref={ref} id="chapter-2" label="proof" heightVh={300}>
      <StickyStage>
        <GhostNumber value="02" progress={scrollYProgress} align="left" />
        <motion.div
          style={{
            width: 300,
            textAlign: "center",
            opacity: exitOpacity,
            scale: exitScale,
            willChange: "opacity, transform",
          }}
        >
          <motion.div
            style={{
              opacity: multOpacity,
              fontFamily: SANS,
              fontSize: "clamp(36px, 8vw, 64px)",
              fontWeight: 700,
              color: C.amber,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              marginBottom: 18,
            }}
          >
            <motion.span>{multText}</motion.span>
          </motion.div>
          <motion.div
            style={{ opacity: labelOpacity, display: "flex", justifyContent: "center", gap: 40 }}
          >
            {["with a network", "without"].map((l) => (
              <span
                key={l}
                style={{
                  width: 80,
                  fontFamily: MONO,
                  fontSize: 10,
                  color: C.textDisabled,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                {l}
              </span>
            ))}
          </motion.div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
              gap: 40,
              height: 200,
              marginTop: 12,
            }}
          >
            <motion.div
              style={{
                width: 80,
                height: leftBarHeight,
                background: "linear-gradient(to top, #f59e0b, rgba(245,158,11,0.3))",
                borderRadius: "4px 4px 0 0",
                willChange: "height",
              }}
            />
            <motion.div
              style={{
                width: 80,
                height: rightBarHeight,
                background: "linear-gradient(to top, #30363d, rgba(48,54,61,0.3))",
                borderRadius: "4px 4px 0 0",
                willChange: "height",
              }}
            />
          </div>
          <div style={{ width: 240, height: 1, background: C.border, margin: "0 auto" }} />

          <motion.p
            style={{
              opacity: statOpacity,
              y: statY,
              fontFamily: SANS,
              fontSize: "clamp(18px, 3vw, 24px)",
              fontWeight: 500,
              color: C.textPrimary,
              maxWidth: 480,
              margin: "32px auto 0",
              willChange: "opacity, transform",
            }}
          >
            Founders with strong peer networks grow 2-3x faster.
          </motion.p>
          <motion.p
            style={{
              opacity: sourceOpacity,
              fontFamily: MONO,
              fontSize: 9,
              color: C.textDisabled,
              letterSpacing: "0.06em",
              margin: "8px 0 0",
            }}
          >
            // source: Enterprise Nation / peer group research
          </motion.p>
        </motion.div>
      </StickyStage>
    </Chapter>
  );
}
