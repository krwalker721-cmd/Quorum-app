"use client";

import { useRef } from "react";
import { motion, useTransform } from "framer-motion";
import { Chapter, StickyStage, useChapterScroll, MaskLine, GhostNumber } from "./sticky";
import { C, MONO, SANS, hexToRgba } from "./theme";

// The three-part promise, previously a beat of its own in chapter 4. Lives here
// so the "what you actually get" line lands inside the manifesto's escalation
// instead of restating it a chapter later.
const PROMISE = ["Find your people", "Get real advice", "Build together"];

// Chapters 3 — the manifesto. Replaces the two near-identical fade lines
// (bridge + pivot) with one continuous escalation: a stacked headline wipes up
// line by line, a rule grows, the three-part promise lands beat by beat, then
// the pivot statement resolves — all scrubbed against scroll so the meaning
// builds as you move. The whole stage recedes into the atmosphere on exit.
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
    <Chapter ref={ref} id="chapter-3" label="the difference" heightVh={390}>
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

          {/* The three-part promise — its own beat. Each part wipes in on its
              own, so it reads as a list you can hold rather than one long line. */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "baseline",
              flexWrap: "wrap",
              gap: "8px 18px",
              marginBottom: 26,
            }}
          >
            {PROMISE.map((part, i) => (
              <div key={part} style={{ display: "flex", alignItems: "baseline", gap: "18px" }}>
                <div
                  style={{
                    fontFamily: SANS,
                    fontSize: "clamp(14px, 2vw, 18px)",
                    fontWeight: 500,
                    color: C.textPrimary,
                    letterSpacing: "-0.005em",
                  }}
                >
                  <MaskLine
                    progress={scrollYProgress}
                    range={[0.42 + i * 0.05, 0.54 + i * 0.05]}
                  >
                    {part}
                  </MaskLine>
                </div>
                {i < PROMISE.length - 1 && (
                  <span
                    aria-hidden
                    style={{ fontFamily: MONO, fontSize: 11, color: C.textDisabled }}
                  >
                    ·
                  </span>
                )}
              </div>
            ))}
          </div>

          <div
            style={{
              fontFamily: MONO,
              fontSize: "clamp(11px, 1.5vw, 13px)",
              color: C.textMuted,
              letterSpacing: "0.08em",
              textAlign: "center",
              marginBottom: 22,
            }}
          >
            <MaskLine progress={scrollYProgress} range={[0.56, 0.66]}>
              all in one place
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
            <MaskLine progress={scrollYProgress} range={[0.72, 0.86]}>
              You&rsquo;ll get there faster — with the right people around you.
            </MaskLine>
          </div>
        </motion.div>
      </StickyStage>
    </Chapter>
  );
}
