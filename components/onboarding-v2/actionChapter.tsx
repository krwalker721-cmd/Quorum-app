"use client";

import { useRef, type ReactNode } from "react";
import { motion, useTransform } from "framer-motion";
import { Chapter, StickyStage, useChapterScroll } from "./sticky";
import { C, MONO } from "./theme";

// Shared frame for the interactive chapters (profile, skills, cohort, first
// post, check-in): a sticky-pinned stage where a context line fades in, then the
// card slides up from below as the user scrolls into it. Children render inside
// the slide-up card slot. `overflow: visible` keeps tall forms from clipping.
export function ActionChapter({
  id,
  context,
  contextColor = C.textDisabled,
  maxWidth = 520,
  children,
}: {
  id: string;
  context: string;
  contextColor?: string;
  maxWidth?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useChapterScroll(ref);

  const contextOpacity = useTransform(scrollYProgress, [0.05, 0.15], [0, 1]);
  const cardY = useTransform(scrollYProgress, [0.15, 0.35], [60, 0]);
  const cardOpacity = useTransform(scrollYProgress, [0.15, 0.35], [0, 1]);

  return (
    <Chapter ref={ref} id={id} heightVh={250}>
      <StickyStage style={{ overflow: "visible" }}>
        <motion.div
          style={{
            opacity: contextOpacity,
            fontFamily: MONO,
            fontSize: 11,
            color: contextColor,
            letterSpacing: "0.08em",
            textAlign: "center",
            marginBottom: 28,
          }}
        >
          {context}
        </motion.div>
        <motion.div
          style={{
            opacity: cardOpacity,
            y: cardY,
            width: "100%",
            maxWidth,
            willChange: "opacity, transform",
          }}
        >
          {children}
        </motion.div>
      </StickyStage>
    </Chapter>
  );
}
