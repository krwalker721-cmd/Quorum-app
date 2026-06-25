"use client";

import { useRef, type ReactNode } from "react";
import { motion, useTransform } from "framer-motion";
import { Chapter, StickyStage, useChapterScroll } from "./sticky";
import { WarpIn } from "./flair";
import { C, MONO } from "./theme";

// Shared frame for the interactive chapters (profile, skills, cohort, first
// post, check-in): a sticky-pinned stage where a context line fades in, then the
// card WARPS in — rising and un-skewing out of the background in 3D — as the
// user scrolls into it. Children render inside the warp-in slot. `overflow:
// visible` keeps tall forms from clipping.
export function ActionChapter({
  id,
  label,
  context,
  contextColor = C.textDisabled,
  maxWidth = 520,
  children,
}: {
  id: string;
  label?: string;
  context: string;
  contextColor?: string;
  maxWidth?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useChapterScroll(ref);

  const contextOpacity = useTransform(scrollYProgress, [0.05, 0.15, 0.85, 1], [0, 1, 1, 0]);
  const contextY = useTransform(scrollYProgress, [0.05, 0.15], [12, 0]);

  return (
    <Chapter ref={ref} id={id} label={label} heightVh={250}>
      <StickyStage style={{ overflow: "visible" }}>
        <motion.div
          style={{
            opacity: contextOpacity,
            y: contextY,
            fontFamily: MONO,
            fontSize: 11,
            color: contextColor,
            letterSpacing: "0.08em",
            textAlign: "center",
            marginBottom: 28,
            willChange: "opacity, transform",
          }}
        >
          {context}
        </motion.div>
        <WarpIn
          progress={scrollYProgress}
          range={[0.12, 0.42]}
          style={{ width: "100%", maxWidth }}
        >
          {children}
        </WarpIn>
      </StickyStage>
    </Chapter>
  );
}
