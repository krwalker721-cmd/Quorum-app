"use client";

import { useRef } from "react";
import { motion, useTransform } from "framer-motion";
import { Chapter, StickyStage, useChapterScroll, MaskLine, GhostNumber } from "./sticky";
import { C, MONO, SANS, hexToRgba } from "./theme";

// Chapters 3 — the manifesto. Replaces the two near-identical fade lines
// (bridge + pivot) with one continuous escalation: a stacked headline wipes up
// line by line, a rule grows, a clipped sub-line lands, then the pivot statement
// resolves — all scrubbed against scroll so the meaning builds as you move. The
// whole stage recedes into the atmosphere on exit.
export function ChapterManifesto() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useChapterScroll(ref);

  const eyebrowOpacity = useTransform(scrollYProgress, [0.04, 0.12], [0, 1]);
  const ruleWidth = useTransform(scrollYProgress, [0.34, 0.5], ["0%", "100%"]);

  // Exit recede — content sinks back into the background as the next chapter rises.
  const exitOpacity = useTransform(scrollYProgress, [0.82, 1], [1, 0]);
  const exitScale = useTransform(scrollYProgress, [0.82, 1], [1, 1.06]);

  const head = "clamp(26px, 5vw, 46px)";

  return (
    <Chapter ref={ref} id="chapter-3" label="the difference" heightVh={340}>
      <StickyStage>
        <GhostNumber value="03" progress={scrollYProgress} align="right" />
        <motion.div
          style={{
            opacity: exitOpacity,
            scale: exitScale,
            width: "100%",
            maxWidth: 720,
            willChange: "opacity, transform",
          }}
        >
          <motion.div
            style={{
              opacity: eyebrowOpacity,
              fontFamily: MONO,
              fontSize: 11,
              color: C.amber,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              textAlign: "center",
              marginBottom: 28,
            }}
          >
            // the difference
          </motion.div>

          <div
            style={{
              fontFamily: SANS,
              fontSize: head,
              fontWeight: 600,
              color: C.textPrimary,
              lineHeight: 1.12,
              textAlign: "center",
              letterSpacing: "-0.01em",
            }}
          >
            <MaskLine progress={scrollYProgress} range={[0.1, 0.24]}>
              This is what happens
            </MaskLine>
            <MaskLine progress={scrollYProgress} range={[0.16, 0.3]}>
              when founders stop
            </MaskLine>
            <MaskLine progress={scrollYProgress} range={[0.22, 0.36]}>
              figuring it out alone.
            </MaskLine>
          </div>

          <motion.div
            style={{
              width: ruleWidth,
              maxWidth: 220,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${hexToRgba(C.amber, 0.6)}, transparent)`,
              margin: "28px auto",
            }}
          />

          <div
            style={{
              fontFamily: MONO,
              fontSize: "clamp(12px, 1.8vw, 15px)",
              color: C.textSecondary,
              letterSpacing: "0.04em",
              textAlign: "center",
              marginBottom: 22,
            }}
          >
            <MaskLine progress={scrollYProgress} range={[0.44, 0.58]}>
              you move faster · you make sharper calls · you stop guessing
            </MaskLine>
          </div>

          <div
            style={{
              fontFamily: SANS,
              fontSize: "clamp(18px, 2.6vw, 24px)",
              fontWeight: 500,
              color: C.textPrimary,
              lineHeight: 1.4,
              textAlign: "center",
              maxWidth: 560,
              margin: "0 auto",
            }}
          >
            <MaskLine progress={scrollYProgress} range={[0.62, 0.78]}>
              You&rsquo;ll get there faster — with the right people around you.
            </MaskLine>
          </div>
        </motion.div>
      </StickyStage>
    </Chapter>
  );
}
