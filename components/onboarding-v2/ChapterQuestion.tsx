"use client";

import { useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Chapter, StickyStage, useChapterScroll } from "./sticky";
import { C, MONO, SANS, hexToRgba } from "./theme";

const QUESTION =
  "Have you ever wanted a room full of founders who have the same mindset as you — and have already solved the problems you're about to face?";

// Each word rises and brightens across its own slice of the chapter's scroll —
// the opening sentence literally assembles itself under the user's thumb instead
// of firing once on view. Reversible, scrubbed, never a whileInView fade.
function Word({
  children,
  progress,
  start,
}: {
  children: string;
  progress: MotionValue<number>;
  start: number;
}) {
  // Floor keeps the opening sentence legible at rest (no "broken render" first
  // paint); each word still brightens and lifts as it passes under the scroll.
  const opacity = useTransform(progress, [start, start + 0.05], [0.5, 1]);
  const y = useTransform(progress, [start, start + 0.05], [10, 0]);
  return (
    <motion.span
      style={{ opacity, y, display: "inline-block", marginRight: "0.28em", willChange: "transform" }}
    >
      {children}
    </motion.span>
  );
}

// Chapter 1 — the opening question. Words assemble against scroll; conversation
// bubbles fade in; tapping either replies and reveals Quorum's "then keep
// scrolling" before the scroll cue. The whole scene recedes as you scroll out.
export function ChapterQuestion() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useChapterScroll(ref);
  const words = QUESTION.split(" ");

  const [replied, setReplied] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Words assemble across 0.04–0.42 of the chapter's scroll, staggered by index.
  const wordStart = (i: number) => 0.05 + (i / words.length) * 0.34;

  // Bubbles fade in across 0.42–0.52, once the sentence has assembled.
  const bubblesOpacity = useTransform(scrollYProgress, [0.42, 0.52], [0, 1]);
  const bubblesY = useTransform(scrollYProgress, [0.42, 0.52], [20, 0]);

  // Exit recede.
  const exitOpacity = useTransform(scrollYProgress, [0.82, 0.99], [1, 0]);
  const exitScale = useTransform(scrollYProgress, [0.82, 0.99], [1, 1.05]);

  function reply() {
    if (replied) return;
    setReplied(true);
    setTimeout(() => setShowHint(true), 1000);
  }

  const userBubble = (text: string, delay: number) => (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={reply}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && reply()}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ delay, duration: 0.4 }}
      style={{
        alignSelf: "flex-end",
        background: hexToRgba(C.amber, 0.08),
        border: `1px solid ${hexToRgba(C.amber, 0.2)}`,
        borderRadius: "12px 4px 4px 12px",
        padding: "12px 20px",
        fontFamily: SANS,
        fontSize: 15,
        color: C.textPrimary,
        cursor: "pointer",
        maxWidth: 320,
      }}
    >
      {text}
    </motion.div>
  );

  return (
    <Chapter ref={ref} id="chapter-1" label="the question" heightVh={320}>
      <StickyStage>
        <motion.div
          style={{
            opacity: exitOpacity,
            scale: exitScale,
            width: "100%",
            maxWidth: 640,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            willChange: "opacity, transform",
          }}
        >
          <p
            style={{
              fontFamily: SANS,
              fontSize: "clamp(22px, 4vw, 32px)",
              fontWeight: 500,
              color: C.textPrimary,
              lineHeight: 1.5,
              textAlign: "center",
              margin: 0,
            }}
          >
            {words.map((w, i) => (
              <Word key={i} progress={scrollYProgress} start={wordStart(i)}>
                {w}
              </Word>
            ))}
          </p>

          {/* Conversation */}
          <div
            style={{
              width: "100%",
              maxWidth: 380,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              minHeight: 120,
            }}
          >
            <AnimatePresence mode="wait">
              {!replied ? (
                <motion.div
                  key="bubbles"
                  style={{
                    opacity: bubblesOpacity,
                    y: bubblesY,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    willChange: "opacity, transform",
                  }}
                >
                  {userBubble("That's exactly what I've been missing", 0)}
                  {userBubble("Tell me more", 0.3)}
                </motion.div>
              ) : (
                <motion.div
                  key="response"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  style={{
                    alignSelf: "flex-start",
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: "4px 12px 12px 4px",
                    padding: "12px 20px",
                    fontFamily: SANS,
                    fontSize: 15,
                    color: C.textSecondary,
                    maxWidth: 320,
                  }}
                >
                  Then keep scrolling.
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {showHint && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, y: [0, 6, 0] }}
                transition={{
                  opacity: { duration: 0.5 },
                  y: { repeat: Infinity, duration: 1.5, ease: "easeInOut" },
                }}
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: C.textDisabled,
                  letterSpacing: "0.1em",
                  textAlign: "center",
                }}
              >
                scroll ↓
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </StickyStage>
    </Chapter>
  );
}
