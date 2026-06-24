"use client";

import { useRef, type ReactNode } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { Chapter, StickyStage, useChapterScroll } from "./sticky";
import { C, MONO, SANS } from "./theme";

// A beat absolutely centered in the sticky stage; its opacity/lift are driven by
// the chapter's scroll progress so beats hand off to one another.
function Beat({
  opacity,
  y,
  children,
}: {
  opacity: MotionValue<number>;
  y: MotionValue<number>;
  children: ReactNode;
}) {
  return (
    <motion.div
      style={{
        opacity,
        y,
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 20px",
        textAlign: "center",
        willChange: "opacity, transform",
      }}
    >
      {children}
    </motion.div>
  );
}

// Chapter 5 — three beats. Beats 1 and 2 fade out before the next arrives; only
// beat 3 lingers, joined by a thin divider.
export function ChapterIntroduction() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useChapterScroll(ref);

  const beat1Opacity = useTransform(scrollYProgress, [0.05, 0.25, 0.3, 0.35], [0, 1, 1, 0]);
  const beat1Y = useTransform(scrollYProgress, [0.05, 0.25], [30, 0]);
  const beat2Opacity = useTransform(scrollYProgress, [0.35, 0.5, 0.6, 0.65], [0, 1, 1, 0]);
  const beat2Y = useTransform(scrollYProgress, [0.35, 0.5], [30, 0]);
  const beat3Opacity = useTransform(scrollYProgress, [0.65, 0.8], [0, 1]);
  const beat3Y = useTransform(scrollYProgress, [0.65, 0.8], [30, 0]);
  const dividerOpacity = useTransform(scrollYProgress, [0.85, 0.95], [0, 1]);

  return (
    <Chapter ref={ref} id="chapter-5" heightVh={400}>
      <StickyStage>
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <Beat opacity={beat1Opacity} y={beat1Y}>
            <p
              style={{
                fontFamily: SANS,
                fontSize: "clamp(22px, 4vw, 32px)",
                fontWeight: 600,
                color: C.textPrimary,
                maxWidth: 580,
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              That&rsquo;s Quorum. 12 founders. Same drive as you. Already where you want to be.
            </p>
          </Beat>

          <Beat opacity={beat2Opacity} y={beat2Y}>
            <p
              style={{
                fontFamily: SANS,
                fontSize: "clamp(18px, 3vw, 24px)",
                fontWeight: 400,
                color: C.textSecondary,
                maxWidth: 480,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Find your people. Get real advice. Build together. All in one place.
            </p>
          </Beat>

          <Beat opacity={beat3Opacity} y={beat3Y}>
            <div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: "clamp(14px, 2vw, 18px)",
                  fontWeight: 500,
                  color: C.amber,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              >
                // now let&rsquo;s do this
              </div>
              <motion.div
                style={{
                  opacity: dividerOpacity,
                  height: 1,
                  width: 120,
                  background: C.border,
                  margin: "24px auto 0",
                }}
              />
            </div>
          </Beat>
        </div>
      </StickyStage>
    </Chapter>
  );
}
