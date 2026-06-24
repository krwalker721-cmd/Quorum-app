"use client";

import { useRef } from "react";
import { motion, useTransform } from "framer-motion";
import { Chapter, StickyStage, useChapterScroll } from "./sticky";
import { C, SANS } from "./theme";

// Chapter 4 — the pivot line. Same fade/scale technique as the bridge, quieter.
export function ChapterPivot() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useChapterScroll(ref);
  const opacity = useTransform(scrollYProgress, [0.1, 0.4, 0.8, 1], [0, 1, 1, 0]);
  const scale = useTransform(scrollYProgress, [0.1, 0.4], [0.95, 1]);

  return (
    <Chapter ref={ref} id="chapter-4" heightVh={200}>
      <StickyStage>
        <motion.p
          style={{
            opacity,
            scale,
            fontFamily: SANS,
            fontSize: "clamp(18px, 3vw, 24px)",
            fontWeight: 400,
            color: C.textMuted,
            textAlign: "center",
            maxWidth: 500,
            margin: 0,
            lineHeight: 1.5,
            willChange: "opacity, transform",
          }}
        >
          Whatever you&rsquo;re building toward — you&rsquo;ll get there faster with the right people
          around you.
        </motion.p>
      </StickyStage>
    </Chapter>
  );
}
