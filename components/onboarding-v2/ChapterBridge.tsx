"use client";

import { useRef } from "react";
import { motion, useTransform } from "framer-motion";
import { Chapter, StickyStage, useChapterScroll } from "./sticky";
import { C, SANS } from "./theme";

// Chapter 3 — the bridge line. Fades and scales up against scroll.
export function ChapterBridge() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useChapterScroll(ref);
  const opacity = useTransform(scrollYProgress, [0.1, 0.4, 0.8, 1], [0, 1, 1, 0]);
  const scale = useTransform(scrollYProgress, [0.1, 0.4], [0.95, 1]);

  return (
    <Chapter ref={ref} id="chapter-3" heightVh={200}>
      <StickyStage>
        <motion.p
          style={{
            opacity,
            scale,
            fontFamily: SANS,
            fontSize: "clamp(20px, 3.5vw, 28px)",
            fontWeight: 500,
            color: C.textSecondary,
            textAlign: "center",
            maxWidth: 520,
            margin: 0,
            lineHeight: 1.5,
            willChange: "opacity, transform",
          }}
        >
          This is what happens when founders stop figuring it out alone.
        </motion.p>
      </StickyStage>
    </Chapter>
  );
}
