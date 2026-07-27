"use client";

import { useRef } from "react";
import { motion, useTransform } from "framer-motion";
import { Chapter, StickyStage, useChapterScroll, GhostNumber } from "./sticky";
import { C, MONO } from "./theme";

// Chapter 4 — the turn. What Quorum is has already been made in chapters 3 and
// 5 (the manifesto's three-part promise, the founders drifting past), so this
// chapter no longer restates it. Its only job now is to close the case and hand
// off into the part where the user builds themselves in.
export function ChapterIntroduction() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useChapterScroll(ref);

  const opacity = useTransform(scrollYProgress, [0.12, 0.34, 0.8, 0.95], [0, 1, 1, 0]);
  const y = useTransform(scrollYProgress, [0.12, 0.34], [24, 0]);
  const dividerOpacity = useTransform(scrollYProgress, [0.4, 0.55], [0, 1]);

  return (
    <Chapter ref={ref} id="chapter-5" label="quorum" heightVh={170}>
      <StickyStage>
        <GhostNumber value="04" progress={scrollYProgress} align="left" />
        <motion.div style={{ opacity, y, textAlign: "center", willChange: "opacity, transform" }}>
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
        </motion.div>
      </StickyStage>
    </Chapter>
  );
}
